from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok'})


from apps.books.views import MediaUploadView

urlpatterns = [
    path('api/health', health_check),
    path('api/upload/media', MediaUploadView.as_view()),
    path('api/auth/', include('apps.users.auth_urls')),
    path('api/users/', include('apps.users.user_urls')),
    path('api/setup/', include('apps.core.setup_urls')),
    path('api/admin/', include('apps.core.admin_urls')),
    path('api/books/', include('apps.books.book_urls')),
    path('api/books/', include('apps.discussions.urls')),
    path('api/authors/', include('apps.books.author_urls')),
    path('api/series/', include('apps.books.series_urls')),
    path('api/tags/', include('apps.books.tag_urls')),
    path('api/shelves/', include('apps.books.shelf_urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/telegram/upload/', include('apps.telegram_upload.urls')),
    path('opds/', include('apps.opds.urls')),
    re_path(r'^uploads/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
