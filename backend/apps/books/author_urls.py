from django.urls import path
from . import views

urlpatterns = [
    path('', views.AuthorListView.as_view()),
    path('<str:author_id>/books', views.AuthorBooksView.as_view()),
    path('<str:author_id>', views.AuthorDetailView.as_view()),
]
