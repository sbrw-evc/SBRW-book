from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0006_bookcomment_media_urls'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookfile',
            name='version_label',
            field=models.CharField(max_length=100, blank=True, default=''),
        ),
    ]
