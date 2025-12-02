package com.tomou.tomouwidget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import com.tomou.R;

public class TomouWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE = "com.tomou.UPDATE_WIDGET";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.my_widget);

            // Botão que aciona o Headless JS
            Intent intent = new Intent(context, TomouWidgetReceiver.class);
            intent.setAction(ACTION_UPDATE);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                widgetId,
                intent,
                PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btnUpdate, pendingIntent);

            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }
}
