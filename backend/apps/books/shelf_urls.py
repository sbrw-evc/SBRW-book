from django.urls import path
from . import views

urlpatterns = [
    path('', views.ShelfListView.as_view()),
    path('<str:shelf_id>/books/<str:book_id>', views.ShelfBookView.as_view()),
    path('<str:shelf_id>', views.ShelfDetailView.as_view()),
]
