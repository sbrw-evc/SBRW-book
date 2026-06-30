import logging

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .handlers import handle_update

logger = logging.getLogger(__name__)


class UploadBotWebhookView(APIView):
    """Receives webhook updates from the Telegram upload bot."""
    permission_classes    = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            handle_update(request.data)
        except Exception as exc:
            logger.exception('Unhandled error in upload bot webhook: %s', exc)
        return Response({'ok': True})
