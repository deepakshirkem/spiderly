import { EnvironmentProviders, makeEnvironmentProviders, APP_INITIALIZER, ErrorHandler, Provider } from "@angular/core";
import { MessageService, ConfirmationService } from "primeng/api";
import { authInitializer } from "../services/app-initializer";
import { AuthBaseService } from "../services/auth-base.service";
import { SpiderlyErrorHandler } from "../handlers/spiderly-error-handler";
import { DialogService } from "primeng/dynamicdialog";

/**
 * Provides core services and configuration for the Spiderly library.
 * 
 * @param spiderlyCoreConfig Optional configuration object for Spiderly core.
 * @returns EnvironmentProviders for Angular's dependency injection system.
 * 
 * Usage:
 * Call this function in your application's providers to set up core services.
 */
export function provideSpiderlyCore(spiderlyCoreConfig?: SpiderlyCoreConfig): EnvironmentProviders {
  const useAuth = spiderlyCoreConfig?.useAuth ?? true;

  const providers: Provider[] = [
    MessageService,
    ConfirmationService,
    DialogService,
    {
      provide: ErrorHandler,
      useClass: SpiderlyErrorHandler,
    },
  ];

  if (useAuth === true) {
    providers.push({
      provide: APP_INITIALIZER,
      useFactory: authInitializer,
      multi: true,
      deps: [AuthBaseService],
    });
  }

  return makeEnvironmentProviders(providers);
}

/**
 * Configuration options for Spiderly core module.
 */
export interface SpiderlyCoreConfig {
  /**
   * Whether to enable authentication features.
   * Defaults to true. Set to false to disable authentication-related providers and initializers.
   */
  useAuth?: boolean;
}