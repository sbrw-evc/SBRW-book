import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.group_name = f'chat_room_{self.room_id}'

        user = await self._authenticate()
        if user is None:
            await self.close(code=4001)
            return

        if not await self._is_member(user):
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
                                                                                 
        pass

                                                                          
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['data']))

                                       
    async def chat_delete(self, event):
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def _authenticate(self):
        qs = parse_qs(self.scope.get('query_string', b'').decode())
        token_str = (qs.get('token') or [None])[0]
        if not token_str:
            return None
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.users.models import User
            token = AccessToken(token_str)
            return User.objects.get(id=token['user_id'], is_active=True)
        except Exception:
            return None

    @database_sync_to_async
    def _is_member(self, user):
        from .models import ChatRoom
        return ChatRoom.objects.filter(id=self.room_id, members=user).exists()
