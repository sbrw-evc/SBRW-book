import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Author',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(db_index=True, max_length=255, unique=True)),
                ('sort_name', models.CharField(blank=True, max_length=255, null=True)),
                ('bio', models.TextField(blank=True, null=True)),
                ('photo', models.CharField(blank=True, max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'authors',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Series',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(db_index=True, max_length=255, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'series',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(db_index=True, max_length=100, unique=True)),
            ],
            options={
                'db_table': 'tags',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Book',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(db_index=True, max_length=500)),
                ('sort_title', models.CharField(blank=True, max_length=500, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('cover_path', models.CharField(blank=True, max_length=500, null=True)),
                ('isbn', models.CharField(blank=True, max_length=20, null=True)),
                ('language', models.CharField(blank=True, default='ru', max_length=10, null=True)),
                ('published_year', models.IntegerField(blank=True, null=True)),
                ('publisher', models.CharField(blank=True, max_length=255, null=True)),
                ('page_count', models.IntegerField(blank=True, null=True)),
                ('avg_rating', models.FloatField(default=0.0)),
                ('rating_count', models.IntegerField(default=0)),
                ('download_count', models.IntegerField(default=0)),
                ('view_count', models.IntegerField(default=0)),
                ('is_public', models.BooleanField(default=True)),
                ('uploaded_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='uploaded_books',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'books',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BookAuthor',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.book')),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.author')),
            ],
            options={
                'db_table': 'book_authors',
            },
        ),
        migrations.CreateModel(
            name='BookSeries',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('series_index', models.FloatField(blank=True, null=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.book')),
                ('series', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.series')),
            ],
            options={
                'db_table': 'book_series',
            },
        ),
        migrations.CreateModel(
            name='BookTag',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.book')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.tag')),
            ],
            options={
                'db_table': 'book_tags',
            },
        ),
        migrations.CreateModel(
            name='BookFile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('format', models.CharField(max_length=20)),
                ('file_path', models.CharField(max_length=500)),
                ('file_size', models.BigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='books.book')),
            ],
            options={
                'db_table': 'book_files',
            },
        ),
        migrations.CreateModel(
            name='ReadingProgress',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('cfi_position', models.CharField(blank=True, max_length=500, null=True)),
                ('percentage', models.FloatField(default=0.0)),
                ('last_read', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reading_progress',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('book', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reading_progress',
                    to='books.book',
                )),
            ],
            options={
                'db_table': 'reading_progress',
            },
        ),
        migrations.CreateModel(
            name='Shelf',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_public', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='shelves',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'shelves',
            },
        ),
        migrations.CreateModel(
            name='ShelfBook',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('shelf', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shelf_books', to='books.shelf')),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='books.book')),
            ],
            options={
                'db_table': 'shelf_books',
            },
        ),
        migrations.CreateModel(
            name='UserRating',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('rating', models.IntegerField()),
                ('review', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ratings',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('book', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ratings',
                    to='books.book',
                )),
            ],
            options={
                'db_table': 'user_ratings',
            },
        ),
        migrations.AddField(
            model_name='book',
            name='authors',
            field=models.ManyToManyField(blank=True, related_name='books', through='books.BookAuthor', to='books.author'),
        ),
        migrations.AddField(
            model_name='book',
            name='series',
            field=models.ManyToManyField(blank=True, related_name='books', through='books.BookSeries', to='books.series'),
        ),
        migrations.AddField(
            model_name='book',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='books', through='books.BookTag', to='books.tag'),
        ),
        migrations.AlterUniqueTogether(
            name='bookauthor',
            unique_together={('book', 'author')},
        ),
        migrations.AlterUniqueTogether(
            name='bookseries',
            unique_together={('book', 'series')},
        ),
        migrations.AlterUniqueTogether(
            name='booktag',
            unique_together={('book', 'tag')},
        ),
        migrations.AlterUniqueTogether(
            name='readingprogress',
            unique_together={('user', 'book')},
        ),
        migrations.AlterUniqueTogether(
            name='shelfbook',
            unique_together={('shelf', 'book')},
        ),
        migrations.AlterUniqueTogether(
            name='userrating',
            unique_together={('user', 'book')},
        ),
    ]
