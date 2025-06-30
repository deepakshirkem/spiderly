import { provideTransloco, TranslocoModule } from '@jsverse/transloco';
import { EnvironmentProviders, importProvidersFrom, ModuleWithProviders, NgModule } from '@angular/core';

import { SpiderlyTranslocoLoader } from '../services/spiderly-transloco-loader';
import { provideTranslocoPreloadLangs } from '@jsverse/transloco-preload-langs';

/**
 * Provides Transloco with Spiderly-specific configuration.
 * @param config Optional configuration for available, preload, default, and fallback languages.
 * @returns EnvironmentProviders for Angular DI.
 */
export function provideSpiderlyTransloco(config?: SpiderlyTranslocoConfig): EnvironmentProviders {
  return importProvidersFrom(
    SpiderlyTranslocoModule.forRoot(config)
  );
}

/**
 * Angular module for Spiderly Transloco integration.
 */
@NgModule({
  imports: [TranslocoModule],
  exports: [TranslocoModule],
})
export class SpiderlyTranslocoModule {

    /**
   * Configures the module with custom translation settings.
   * @param config Optional SpiderlyTranslocoConfig object.
   * @returns ModuleWithProviders for Angular module system.
   */
  static forRoot(config?: SpiderlyTranslocoConfig): ModuleWithProviders<SpiderlyTranslocoModule> {
    return {
      ngModule: SpiderlyTranslocoModule,
      providers: [
        provideTranslocoPreloadLangs(config.preloadLangs ?? ['en']),
        provideTransloco({
          config: {
            availableLangs: config?.availableLangs ?? [
              'en', 'en.generated',
              'sr-Latn-RS', 'sr-Latn-RS.generated', 
            ],
            defaultLang: config?.defaultLang ?? 'en',
            fallbackLang: config?.fallbackLang ?? 'en.generated',
            missingHandler: {
              useFallbackTranslation: true,
              logMissingKey: false,
            },
            reRenderOnLangChange: true,
          },
          loader: SpiderlyTranslocoLoader
        }),
      ],
    };
  }

}

/**
 * Configuration interface for Spiderly Transloco.
 */
export interface SpiderlyTranslocoConfig {
    /**
   * List of language codes that are available for translation in your app.
   * Example: ['en', 'en.generated', 'sr-Latn-RS', 'sr-Latn-RS.generated']
   * See the full list of language codes here:
   * https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
   */
  availableLangs: string[];

    /**
   * List of language codes to preload at app startup.
   * Example: ['en', 'en.generated']
   * Only these languages will be loaded immediately; others load on demand.
   */
  preloadLangs: string[];

    /**
   * The default language code to use if no language is set.
   * Example: 'en'
   */
  defaultLang: string;

    /**
   * The fallback language code to use if a translation key is missing.
   * Example: 'en.generated'
   */
  fallbackLang: string;
}