package com.tomou.tomouwidget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.facebook.react.HeadlessJsTaskService;

public class TomouWidgetReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        Intent service = new Intent(context, TomouWidgetService.class);
        service.putExtras(intent);

        context.startService(service);
        HeadlessJsTaskService.acquireWakeLockNow(context);
    }
}
