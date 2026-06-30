from django.urls import path
from .consumers import BookDiscussionConsumer

websocket_urlpatterns = [
    path('ws/books/<str:book_id>/discussions/', BookDiscussionConsumer.as_asgi()),
]
