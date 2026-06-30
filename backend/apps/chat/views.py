from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.users.models import User
from .models import ChatRoom, ChatMembership, ChatMessage
from .serializers import ChatRoomSerializer, ChatMessageSerializer


def _broadcast(room_id, event_type, data):
    """Send a message to the WebSocket group for a room (non-async context)."""
    layer = get_channel_layer()
    if layer:
        async_to_sync(layer.group_send)(
            f'chat_room_{room_id}',
            {'type': event_type, 'data': data},
        )


class ChatRoomListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = (
            ChatRoom.objects
            .filter(members=request.user)
            .prefetch_related('members', 'messages__user')
            .order_by('-updated_at')
        )
        return Response(ChatRoomSerializer(rooms, many=True).data)

    def post(self, request):
        member_ids = request.data.get('member_ids', [])
        name = (request.data.get('name') or '').strip()
        is_group = bool(request.data.get('is_group', False))

        if not member_ids:
            return Response({'detail': 'member_ids required'}, status=400)

                                        
        all_ids = list(set([str(request.user.id)] + [str(i) for i in member_ids]))
        members = User.objects.filter(id__in=all_ids)
        if members.count() < 2:
            return Response({'detail': 'At least 2 members required'}, status=400)

                                                        
        if not is_group and len(all_ids) == 2:
            other_id = [i for i in all_ids if i != str(request.user.id)][0]
            existing = (
                ChatRoom.objects
                .filter(is_group=False, members=request.user)
                .filter(members__id=other_id)
                .first()
            )
            if existing:
                return Response(ChatRoomSerializer(existing).data)

        room = ChatRoom.objects.create(
            name=name,
            is_group=is_group,
            created_by=request.user,
        )
        for member in members:
            ChatMembership.objects.create(room=room, user=member)

        room.refresh_from_db()
        room_data = ChatRoom.objects.prefetch_related('members', 'messages__user').get(id=room.id)
        return Response(ChatRoomSerializer(room_data).data, status=201)


class ChatRoomDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_room(self, request, room_id):
        try:
            return ChatRoom.objects.get(id=room_id, members=request.user)
        except ChatRoom.DoesNotExist:
            return None

    def get(self, request, room_id):
        room = self._get_room(request, room_id)
        if not room:
            return Response({'detail': 'Not found'}, status=404)
        return Response(ChatRoomSerializer(room).data)

    def delete(self, request, room_id):
        room = self._get_room(request, room_id)
        if not room:
            return Response({'detail': 'Not found'}, status=404)
        if str(room.created_by_id) != str(request.user.id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)
        room.delete()
        return Response({'success': True})


class ChatRoomMembersView(APIView):
    """Add or remove members from a group chat."""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id, members=request.user)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if not room.is_group:
            return Response({'detail': 'Cannot add members to a direct chat'}, status=400)
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=404)
        ChatMembership.objects.get_or_create(room=room, user=user)
        return Response({'success': True})

    def delete(self, request, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id, members=request.user)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        user_id = request.data.get('user_id')
        ChatMembership.objects.filter(room=room, user_id=user_id).delete()
        return Response({'success': True})


class ChatMessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        try:
            ChatRoom.objects.get(id=room_id, members=request.user)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        after = request.query_params.get('after')
        qs = ChatMessage.objects.filter(room_id=room_id).select_related('user').order_by('created_at')
        if after:
            qs = qs.filter(created_at__gt=after)
        messages = list(qs[:200])
        return Response(ChatMessageSerializer(messages, many=True).data)

    def post(self, request, room_id):
        try:
            room = ChatRoom.objects.get(id=room_id, members=request.user)
        except ChatRoom.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        text = (request.data.get('text') or '').strip()
        media_urls = request.data.get('media_urls') or []
        if not text and not media_urls:
            return Response({'detail': 'text or media_urls required'}, status=400)
        msg = ChatMessage.objects.create(
            room=room,
            user=request.user,
            text=text,
            media_urls=media_urls if isinstance(media_urls, list) else [],
        )
        room.save(update_fields=['updated_at'])
        payload = {
            'type': 'new_message',
            'id': str(msg.id),
            'room_id': str(msg.room_id),
            'user_id': str(msg.user_id),
            'username': request.user.username,
            'avatar': request.user.avatar,
            'text': msg.text,
            'media_urls': msg.media_urls,
            'created_at': msg.created_at.isoformat(),
            'updated_at': msg.updated_at.isoformat(),
        }
        _broadcast(room_id, 'chat_message', payload)
        return Response(ChatMessageSerializer(msg).data, status=201)


class ChatMessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, room_id, message_id):
        try:
            msg = ChatMessage.objects.get(id=message_id, room_id=room_id)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if str(msg.user_id) != str(request.user.id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)
        msg.delete()
        _broadcast(room_id, 'chat_delete', {'type': 'deleted', 'id': str(message_id)})
        return Response({'success': True})
