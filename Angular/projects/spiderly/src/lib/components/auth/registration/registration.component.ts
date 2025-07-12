import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef, Component, KeyValueDiffers, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LayoutBaseService } from '../../../services/app-layout-base.service';
import { AuthBaseService } from '../../../services/auth-base.service';
import { BaseFormCopy } from '../../base-form/base-form copy';
import { SpiderlyFormGroup } from '../../spiderly-form-control/spiderly-form-control';
import { Registration } from '../../../entities/security-entities';
import { SpiderlyMessageService } from '../../../services/spiderly-message.service';
import { BaseFormService } from '../../../services/base-form.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthComponent } from '../partials/auth.component';
import { SpiderlyControlsModule } from '../../../controls/spiderly-controls.module';
import { RegistrationVerificationComponent } from '../partials/registration-verification.component';

@Component({
    selector: 'app-registration',
    templateUrl: './registration.component.html',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        AuthComponent,
        SpiderlyControlsModule,
        RegistrationVerificationComponent,
        TranslocoDirective,
    ]
})
export class RegistrationComponent extends BaseFormCopy implements OnInit {
    registrationFormGroup = new SpiderlyFormGroup<Registration>({});

    companyName: string;
    showEmailSentDialog: boolean = false;

    constructor(
        protected override differs: KeyValueDiffers,
        protected override http: HttpClient,
        protected override messageService: SpiderlyMessageService, 
        protected override changeDetectorRef: ChangeDetectorRef,
        protected override router: Router, 
        protected override route: ActivatedRoute,
        protected override translocoService: TranslocoService,
        protected override baseFormService: BaseFormService,
        public layoutService: LayoutBaseService, 
        private authService: AuthBaseService, 
    ) {
        super(differs, http, messageService, changeDetectorRef, router, route, translocoService, baseFormService);
    }

    override ngOnInit(){
        this.initRegistrationFormGroup(new Registration({}));
    }
    
    initRegistrationFormGroup(model: Registration){
        this.initFormGroup(this.registrationFormGroup, this.formGroup, model, model.typeName, []);
    }

    companyNameChange(companyName: string){
        this.companyName = companyName;
    }

    sendRegistrationVerificationEmail() {

        /* This method is called to send a verification email during registration.
        * It retrieves the email from the form control and emits it through the onResendVerificationToken event.
        * It also checks the validity of the form group before proceeding.
        * It updates the control's value if necessary.
        * The email is sent using the authService's sendRegistrationVerificationEmail method.
        * The form group is validated before sending the email.
        */
        const emailControl = this.control('email', this.registrationFormGroup) as any;

        if (emailControl?._pendingValue !== undefined) {
          emailControl.setValue(emailControl._pendingValue);
          emailControl.markAsTouched();
          emailControl.updateValueAndValidity();
        } 

        let isFormGroupValid: boolean = this.baseFormService.checkFormGroupValidity(this.registrationFormGroup);

        if (isFormGroupValid == false) 
            return;

        // const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
        this.authService.sendRegistrationVerificationEmail(this.registrationFormGroup.getRawValue()).subscribe(() => {
            this.showEmailSentDialog = true;
        });
    }

}
