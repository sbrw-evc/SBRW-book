from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0005_add_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookcomment',
            name='media_urls',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='bookcomment',
            name='text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
