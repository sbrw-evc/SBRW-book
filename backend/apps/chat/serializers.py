from rest_framework import serializers
from .models import ChatRoom, ChatMessage, ChatMembership


class ChatMemberSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    avatar = serializers.CharField(allow_null=True)


class ChatMessageSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.CharField(source='user.avatar', read_only=True, allow_null=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'room_id', 'user_id', 'username', 'avatar', 'text', 'media_urls', 'created_at', 'updated_at']


class ChatRoomSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'is_group', 'members', 'last_message', 'unread_count', 'created_at', 'updated_at']

    def get_members(self, obj):
        users = obj.members.all().only('id', 'username', 'avatar')
        return [{'id': str(u.id), 'username': u.username, 'avatar': u.avatar} for u in users]

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'id': str(msg.id),
            'text': msg.text,
            'username': msg.user.username,
            'media_urls': msg.media_urls,
            'created_at': msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        return 0
