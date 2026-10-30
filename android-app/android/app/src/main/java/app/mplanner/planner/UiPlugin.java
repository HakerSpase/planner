package app.mplanner.planner;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Мелочи интерфейса со стороны сайта. Пока выделен текст в редактируемой заметке,
 * системная плашка «Вырезать / Копировать / Вставить» не нужна: те же кнопки есть
 * на нашей панели выделения, а системная её перекрывает.
 */
@CapacitorPlugin(name = "PlannerUi")
public class UiPlugin extends Plugin {
    @PluginMethod
    public void setSelectionMenu(PluginCall call) {
        boolean hidden = Boolean.TRUE.equals(call.getBoolean("hidden", false));
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setSelectionMenuHidden(hidden);
        }
        call.resolve();
    }
}
