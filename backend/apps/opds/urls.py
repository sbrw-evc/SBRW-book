from django.urls import path
from .views import (
    OpdsRootView, OpdsBooksView, OpdsSearchView, OpenSearchView,
    OpdsAuthorsView, OpdsAuthorBooksView,
    OpdsSeriesListView, OpdsSeriesBooksView,
    OpdsGenresView, OpdsGenreBooksView,
)

urlpatterns = [
    path('', OpdsRootView.as_view()),
    path('opensearch.xml', OpenSearchView.as_view()),
    path('books', OpdsBooksView.as_view()),
    path('search', OpdsSearchView.as_view()),
    path('authors', OpdsAuthorsView.as_view()),
    path('authors/<str:author_id>/books', OpdsAuthorBooksView.as_view()),
    path('series', OpdsSeriesListView.as_view()),
    path('series/<str:series_id>/books', OpdsSeriesBooksView.as_view()),
    path('genres', OpdsGenresView.as_view()),
    path('genres/<str:tag_id>/books', OpdsGenreBooksView.as_view()),
]
