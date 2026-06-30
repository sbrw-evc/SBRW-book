from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, AllowAny
from .mongo import discussions_col, reviews_col


def _oid(s):
    try:
        return ObjectId(s)
    except (InvalidId, TypeError):
        return None


def _fmt_discussion(d):
    return {
        'id': str(d['_id']),
        'book_id': d['book_id'],
        'user_id': d['user_id'],
        'username': d.get('username', ''),
        'text': d['text'],
        'parent_id': str(d['parent_id']) if d.get('parent_id') else None,
        'created_at': d['created_at'].isoformat(),
        'updated_at': d.get('updated_at', d['created_at']).isoformat(),
    }


def _fmt_review(r):
    return {
        'id': str(r['_id']),
        'book_id': r['book_id'],
        'user_id': r['user_id'],
        'username': r.get('username', ''),
        'rating': r['rating'],
        'title': r.get('title', ''),
        'text': r.get('text', ''),
        'spoiler': r.get('spoiler', False),
        'created_at': r['created_at'].isoformat(),
        'updated_at': r.get('updated_at', r['created_at']).isoformat(),
    }


class DiscussionListView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request, book_id):
        col = discussions_col()
        items = list(col.find({'book_id': book_id}).sort('created_at', 1).limit(200))
        return Response([_fmt_discussion(d) for d in items])

    def post(self, request, book_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': 'text is required'}, status=400)
        parent_raw = request.data.get('parent_id')
        parent_id = _oid(parent_raw) if parent_raw else None
        now = datetime.now(timezone.utc)
        doc = {
            'book_id': book_id,
            'user_id': str(request.user.id),
            'username': request.user.username,
            'text': text,
            'parent_id': parent_id,
            'created_at': now,
            'updated_at': now,
        }
        result = discussions_col().insert_one(doc)
        doc['_id'] = result.inserted_id
        return Response(_fmt_discussion(doc), status=201)


class DiscussionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, book_id, discussion_id):
        oid = _oid(discussion_id)
        if not oid:
            return Response({'detail': 'Invalid id'}, status=400)
        result = discussions_col().delete_one({'_id': oid, 'user_id': str(request.user.id)})
        if result.deleted_count == 0:
            return Response({'detail': 'Not found or not yours'}, status=404)
        return Response({'success': True})


class ReviewListView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request, book_id):
        col = reviews_col()
        items = list(col.find({'book_id': book_id}).sort('created_at', -1).limit(100))
        return Response([_fmt_review(r) for r in items])

    def post(self, request, book_id):
        rating = request.data.get('rating')
        if not rating or not (1 <= int(rating) <= 5):
            return Response({'detail': 'rating 1-5 required'}, status=400)
        now = datetime.now(timezone.utc)
        doc = {
            'book_id': book_id,
            'user_id': str(request.user.id),
            'username': request.user.username,
            'rating': int(rating),
            'title': (request.data.get('title') or '').strip()[:200],
            'text': (request.data.get('text') or '').strip(),
            'spoiler': bool(request.data.get('spoiler', False)),
            'updated_at': now,
        }
        col = reviews_col()
        existing = col.find_one({'book_id': book_id, 'user_id': str(request.user.id)})
        if existing:
            col.update_one({'_id': existing['_id']}, {'$set': doc})
            doc['_id'] = existing['_id']
            doc['created_at'] = existing['created_at']
        else:
            doc['created_at'] = now
            result = col.insert_one(doc)
            doc['_id'] = result.inserted_id
        return Response(_fmt_review(doc), status=200 if existing else 201)


class ReviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, book_id, review_id):
        oid = _oid(review_id)
        if not oid:
            return Response({'detail': 'Invalid id'}, status=400)
        result = reviews_col().delete_one({'_id': oid, 'user_id': str(request.user.id)})
        if result.deleted_count == 0:
            return Response({'detail': 'Not found or not yours'}, status=404)
        return Response({'success': True})
