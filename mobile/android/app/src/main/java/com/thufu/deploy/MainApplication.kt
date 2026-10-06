package com.thufu.deploy

import android.app.Application
import android.content.res.Configuration
import androidx.annotation.NonNull

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            // Packages that cannot be autolinked yet can be added manually here
            return PackageList(this).packages
          }

          override fun getJSMainModuleName(): String = "index"

          override fun getUseDeveloperSupport(): Boolean = false

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (!BuildConfig.REACT_NATIVE_UNSTABLE_USE_RUNTIME_SCHEDULER_ALWAYS) {
      ReactFeatureFlags.unstable_useRuntimeSchedulerAlways = false
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
    if (BuildConfig.DEBUG) {
      // Disabled: Flipper can trigger unwanted Metro connections in standalone APK
      // ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
  }
}
