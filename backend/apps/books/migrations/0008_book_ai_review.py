from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0007_bookfile_version_label'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='ai_review',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='book',
            name='ai_review_status',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
