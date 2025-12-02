package com.tomou.tomouwidget;

import android.content.Intent;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

public class TomouWidgetService extends HeadlessJsTaskService {

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {

        return new HeadlessJsTaskConfig(
            "WidgetTask",
            null,
            5000,
            true
        );
    }
}
