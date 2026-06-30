from django.urls import path
from .views import UploadBotWebhookView

urlpatterns = [
    path('webhook', UploadBotWebhookView.as_view()),
]
