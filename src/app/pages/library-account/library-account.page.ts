import { Component, OnInit } from '@angular/core';
import { IUBUser, IUBFees, IUBItems, IBibSessionResponse, IBibSession } from 'src/app/lib/interfaces';
import { AbstractPage } from 'src/app/lib/abstract-page';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfigService } from '../../services/config/config.service';
import { ICredentials, ELoginErrors } from 'src/app/services/login-provider/interfaces';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { LoadingController, Events } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { AlertButton } from '@ionic/core';
import { AlertService } from 'src/app/services/alert/alert.service';
import { utils } from 'src/app/lib/util';

@Component({
  selector: 'app-library-account',
  templateUrl: './library-account.page.html',
  styleUrls: ['./library-account.page.scss'],
})
export class LibraryAccountPage extends AbstractPage implements OnInit {

  user: IUBUser;
  fees: IUBFees;
  items: IUBItems;

  userLoaded;
  itemsLoaded;
  feesLoaded;
  feesExpanded = false;

  userError;
  itemsError;
  feesError;

  itemStatus = [];
  grayedOutItemsHint;
  noLoanItems = true;
  activeSegment = 'loan';
  endpoint;

  // this object will hold the data the user enters in the login form
  loginCredentials: ICredentials = {
    username: '',
    password: ''
  };

  bibSession: IBibSession;
  loginForm: FormGroup;
  loading;
  showLoginScreen;

  constructor(
    private translate: TranslateService,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private formBuilder: FormBuilder,
    private storage: Storage,
    private alertService: AlertService,
    private events: Events
  ) {
    super({ requireNetwork: true });
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  async ngOnInit() {
    this.bibSession = await this.storage.get('bibSession');
    this.endpoint = ConfigService.config.webservices.endpoint.libraryPAIA.url;

    if (this.bibSession) {
      if (utils.sessionIsValid(this.bibSession.timestamp, this.bibSession.oidcTokenObject.expires_in, 600)) {
        this.getUser();
        this.getItems();
        this.getFees();
      } else {
        this.loginUB(this.bibSession.credentials);
      }
    } else { this.showLoginScreen = true; }
  }

  loginUB(loginCredentials?: ICredentials) {
    if (this.loginForm.valid || loginCredentials) {

      if (!loginCredentials) {
        this.loginCredentials.username = this.loginForm.controls['username'].value;
        this.loginCredentials.password = this.loginForm.controls['password'].value;
        this.showLoading();
      } else {
        this.loginCredentials.username = loginCredentials.username;
        this.loginCredentials.password = loginCredentials.password;
      }


      const body = {
        username: this.loginCredentials.username,
        password: this.loginCredentials.password,
        grant_type: 'password'
      };

      const headers = new HttpHeaders()
        .append('Authorization', ConfigService.config.webservices.apiToken);

      this.http.post(this.endpoint + 'auth/login', body, { headers: headers }).subscribe((data: IBibSessionResponse) => {
        this.bibSession = {
          credentials: this.loginCredentials,
          token: data.access_token,
          oidcTokenObject: data,
          timestamp: new Date()
        };

        this.storage.set('bibSession', this.bibSession);

        setTimeout(() => {
          this.events.publish('userLogin');
        }, 1000);

        if (!loginCredentials) {
          this.endLoading();
        }

        this.getUser();
        this.getItems();
        this.getFees();
      }, error => {
        this.logger.debug('loginUB()', error);
        this.endLoading();
        this.showAlert(ELoginErrors.AUTHENTICATION);
      });
    }
  }

  getUser() {
    this.userLoaded = false;
    this.userError = false;

    const headers = new HttpHeaders()
      .append('Authorization', 'Bearer ' + this.bibSession.token);

    this.http.get(this.endpoint + 'core/' + this.bibSession.oidcTokenObject.patron, { headers: headers }).subscribe((userData: IUBUser) => {
      this.user = userData;
      this.userLoaded = true;
    }, error => {
      this.logger.debug('getUser()', error);
      this.userLoaded = true;
      this.userError = true;
    });
  }

  getItems() {
    this.itemsLoaded = false;
    this.itemsError = false;

    const headers = new HttpHeaders()
      .append('Authorization', 'Bearer ' + this.bibSession.token);

    this.http.get(this.endpoint + 'core/' + this.bibSession.oidcTokenObject.patron + '/items', {headers: headers})
    .subscribe((itemData: IUBItems) => {
      this.items = itemData;
      this.items.doc.sort((a, b) => {
        if (a.endtime > b.endtime) {
          return 1;
        } else { return -1; }
      });
      this.itemsLoaded = true;
      this.prepareForm();
    }, error => {
      this.logger.debug('getItems()', error);
      this.itemsLoaded = true;
      this.itemsError = true;
    });
  }

  getFees() {
    this.feesLoaded = false;
    this.feesError = false;

    const headers = new HttpHeaders()
      .append('Authorization', 'Bearer ' + this.bibSession.token);

    this.http.get(this.endpoint + 'core/' + this.bibSession.oidcTokenObject.patron + '/fees', { headers: headers })
    .subscribe((feeData: IUBFees) => {
      this.fees = feeData;
      this.feesLoaded = true;
    }, error => {
      this.logger.debug('getFees()', error);
      this.feesLoaded = true;
      this.feesError = true;
    });
  }

  refresh(refresher) {
    this.getUser();
    this.getItems();
    this.getFees();
    if (refresher && refresher.target) {
      refresher.target.complete();
    }
  }

  renewItems() {
    const docsToRenew: IUBItems = {
      'doc': []
    };

    for (let i = 0; i < this.items.doc.length; i++) {
      if (this.itemStatus[i].isChecked) {
        docsToRenew.doc.push(this.items.doc[i]);
      }
    }

    this.renewRequest(docsToRenew);
  }

  renewRequest(items: IUBItems) {
    console.log(items);
    // const headers = new HttpHeaders()
    //   .append('Authorization', 'Bearer ' + this.bibSession.token);

    // this.http.post(this.endpoint + 'core/' + this.bibSession.oidcTokenObject.patron + '/renew', items, {headers: headers})
    // .subscribe(success => {
    //   console.log(success);
    //   this.getItems();
    //   this.getFees();
    // }, error => {
    //   this.logger.debug('renewRequest()', error);
    // });
  }

  prepareForm() {
    for (let i = 0; i < this.items.doc.length; i++) {
      if (this.items.doc[i].status === 3) { this.noLoanItems = false; }

      let renewable;
      if ((this.items.doc[i].queue !== 0) || !this.items.doc[i].canrenew) {
        // item can not be renewed
        renewable = false;
      } else if (this.items.doc[i].canrenew) { renewable = true; }

      if (!renewable) { this.grayedOutItemsHint = true; }

      const endDate = moment(this.items.doc[i].endtime);
      const currentDate = moment();
      const dayDiff = endDate.diff(currentDate, 'days');

      let status;
      if (dayDiff < 0) {
        status = 2;
      } else if (dayDiff < 4) {
        status = 1;
      } else { status = 0; }

      this.itemStatus[i] = {
        'isChecked': false,
        'isRenewable': renewable,
        // status: 0 = ok, 1 = due soon, 2 = late
        'status': status,
        'daysToReturn': dayDiff
      };
    }
  }

  validateCheckboxes() {
    let checked = false;
    for (const status of this.itemStatus) {
      if (status.isChecked) {
        checked = true;
        break;
      }
    }

    return !checked;
  }

  formatItemDates(date) {
    let tmp;
    if (this.translate.currentLang === 'de') {
      tmp = moment(date).format('DD.MM.YYYY');
    } else { tmp = moment(date).format('L'); }
    return tmp;
  }

  abort() {
    this.navCtrl.navigateBack('/home');
  }

  /**
   * @name showLoading
   * @description shows a loading animation
   */
  async showLoading() {
    this.loading = await this.loadingCtrl.create({
      message: this.translate.instant('page.login.loginInProgress'),
      spinner: 'crescent'
    });
    this.loading.present();
  }

  /**
   * @name endLoading
   * @description ends the loading animation
   */
  private endLoading(): void {
    if (this.loading) {
      this.loading.dismiss();
    } else {
      setTimeout(() => {
        this.endLoading();
      }, 250);
    }
  }

  /**
   * @name showAlert
   * @param errorCode
   */
  showAlert(errorCode: ELoginErrors) {
    const buttons: AlertButton[] = [{ text: this.translate.instant('button.continue') }];
    this.alertService.showAlert(
      {
        headerI18nKey: 'alert.title.error',
        messageI18nKey: `page.library-account.loginError.${errorCode}`
      },
      buttons
    );
  }

  formatDate(date) {
    const dateString = new Date(date).toLocaleDateString(this.translate.currentLang);
    return dateString;
  }

}
