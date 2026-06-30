from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0008_book_ai_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='narrator',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.CreateModel(
            name='AudioChapter',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=500)),
                ('chapter_number', models.IntegerField(default=1)),
                ('audio_file', models.CharField(max_length=500)),
                ('duration_seconds', models.IntegerField(blank=True, null=True)),
                ('file_size', models.BigIntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audio_chapters', to='books.book')),
            ],
            options={
                'db_table': 'audio_chapters',
                'ordering': ['chapter_number'],
                'unique_together': {('book', 'chapter_number')},
            },
        ),
    ]
