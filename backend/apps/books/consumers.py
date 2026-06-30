import json
from channels.generic.websocket import AsyncWebsocketConsumer


class BookDiscussionConsumer(AsyncWebsocketConsumer):
    """
    Public WebSocket endpoint for live discussion updates on a book page.
    No auth required — anyone viewing the page receives new comments and deletions.
    """

    async def connect(self):
        self.book_id = self.scope['url_route']['kwargs']['book_id']
        self.group_name = f'book_{self.book_id}_discussions'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass                                          

    async def discussion_new(self, event):
        await self.send(text_data=json.dumps(event['data']))

    async def discussion_delete(self, event):
        await self.send(text_data=json.dumps(event['data']))
