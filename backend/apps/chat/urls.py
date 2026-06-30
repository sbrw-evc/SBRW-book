from django.urls import path
from . import views

urlpatterns = [
    path('', views.ChatRoomListView.as_view()),
    path('<str:room_id>', views.ChatRoomDetailView.as_view()),
    path('<str:room_id>/members', views.ChatRoomMembersView.as_view()),
    path('<str:room_id>/messages', views.ChatMessageListView.as_view()),
    path('<str:room_id>/messages/<str:message_id>', views.ChatMessageDetailView.as_view()),
]
