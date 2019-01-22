import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Events } from 'ionic-angular';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Storage } from "@ionic/storage";
import {
  IConfig,
  IMensaResponse,
  IMeals
} from "../../library/interfaces";
import { CalendarComponentOptions } from 'ion2-calendar';
import { CacheService } from 'ionic-cache';
import { ConnectionProvider } from "../../providers/connection/connection";
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';

@IonicPage()
@Component({
  selector: 'page-mensa',
  templateUrl: 'mensa.html',
})
export class MensaPage {

  // calendar variables
  showBasicCalendar = false;
  date = moment();
  type: 'moment';
  optionsBasic: CalendarComponentOptions = {
    weekdays: this.getWeekdays(),
    showMonthPicker: false,
    weekStart: 1
  };

  currentDate = moment();
  isLoaded = false;
  allMeals: IMeals[] = [];

  mealForDate: boolean[] = [];
  mealIsExpanded: boolean[] = [];
  mealIsFish: boolean[] = [];
  mealIsVegan: boolean[] = [];
  mealIsVegetarian: boolean[] = [];
  allergenIsExpanded: boolean[][] = [];
  noMealsForDate: boolean;

  onlyVeganFood = false;
  onlyVeggieFood = false;

  iconMapping = [];

  campus;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private http: HttpClient,
    private cache: CacheService,
    private connection: ConnectionProvider,
    private translate: TranslateService,
    private swipeEvent: Events,
    private storage: Storage)
  {
    this.isLoaded = false;
  }

  ionViewDidLoad() {
    this.connection.checkOnline(true, true);
  }

  /**
   * checks whether a session is stored in memory. If not the user is taken to
   * the LoginPage. If yes a query is sent to the API and the results are placed
   * in this.personsFound so the view can render them
   * @param query
   */
  public async changeCampus(campus) {
    this.campus = campus;
    this.loadCampusMenu();
  }

  async loadCampusMenu(refresher?) {
    var i;

    if (refresher) {
      this.cache.removeItems("mensaResponse*");
    } else { this.isLoaded = false; }

    this.allMeals = [];
    for (i = 0; i < this.mealIsExpanded.length; i++) { this.mealIsExpanded[i] = false; }
    for (i = 0; i < this.mealForDate.length; i++) { this.mealForDate[i] = false; }
    for (i = 0; i < this.mealIsFish.length; i++) { this.mealIsFish[i] = false; }
    for (i = 0; i < this.mealIsVegan.length; i++) { this.mealIsVegan[i] = false; }
    for (i = 0; i < this.mealIsVegetarian.length; i++) { this.mealIsVegetarian[i] = false; }
    this.noMealsForDate = true;

    let config:IConfig = await this.storage.get("config");

    let headers: HttpHeaders = new HttpHeaders()
      .append("Authorization", config.webservices.apiToken);

    let params: HttpParams = new HttpParams()
      .append("location", this.campus);

    let request = this.http.get(config.webservices.endpoint.mensa, {headers:headers, params:params});
    this.cache.loadFromObservable("mensaResponse"+this.campus, request).subscribe((res:IMensaResponse) => {

      if (res.meal) {
        this.allMeals = res.meal;
      }

      if (res.iconHashMap && res.iconHashMap.entry) {
        this.iconMapping = res.iconHashMap.entry;
      }

      if (this.campus == "Griebnitzsee") {
        let ulfParam = "UlfsCafe"
        let params: HttpParams = new HttpParams()
          .append("location", ulfParam);

        let request = this.http.get(config.webservices.endpoint.mensa, {headers:headers, params:params});

        this.cache.loadFromObservable("mensaResponse" + ulfParam, request).subscribe((resUlf:IMensaResponse) => {
          if (resUlf.meal) {
            for (i = 0; i < resUlf.meal.length; i++) {
              if (!resUlf.meal[i].type) {
                resUlf.meal[i].type = ["Ulf's Café"];
              } else if (resUlf.meal[i].title) {
                resUlf.meal[i].title += " (Ulf's Café)";
              } else { resUlf.meal[i].title = "Ulf's Café"; }

              if (!this.isInArray(this.allMeals, resUlf.meal[i])) {
                this.allMeals.push(resUlf.meal[i]);
              }
            }
          }

          this.classifyMeals();

          if (refresher) {
            refresher.complete();
          }
        });
      } else {
        this.classifyMeals();

        if (refresher) {
          refresher.complete();
        }
      }

    }, error => {
      console.log(error);
    });
  }

  classifyMeals() {
    var i;

    for (i = 0; i < this.allMeals.length; i++) {
      this.allergenIsExpanded[i] = [];
      var mealDate;
      if (this.allMeals[i].date) {
        mealDate = moment(this.allMeals[i].date);
      } else { mealDate = moment(); }

      if (this.currentDate.format('MM DD YYYY') == mealDate.format('MM DD YYYY')) {
        this.mealForDate[i] = true;
        this.noMealsForDate = false;
      } else { this.mealForDate[i] = false; }

      // check for fish, vegan, vegetarian
      if (this.allMeals[i].type && this.allMeals[i].type.length > 0) {
        switch(this.allMeals[i].type[0]) {
          case "Fisch": {
            this.mealIsFish[i] = true;
            this.mealIsVegan[i] = false;
            this.mealIsVegetarian[i] = false;
            break;
          }
          case "Vegan": {
            this.mealIsFish[i] = false;
            this.mealIsVegan[i] = true;
            this.mealIsVegetarian[i] = false;
            break;
          }
          case "Vegetarisch": {
            this.mealIsFish[i] = false;
            this.mealIsVegan[i] = false;
            this.mealIsVegetarian[i] = true;
            break;
          }
        }
      }
    }
    
    this.isLoaded = true;
    this.pickDate(this.date);
  }

  expandMeal(i) {
    var j,k;
    if (this.mealIsExpanded[i]) {
      this.mealIsExpanded[i] = false;
      if (this.allMeals[i].allergens) {
        for (k = 0; k < this.allMeals[i].allergens.length; k++) {
          this.allergenIsExpanded[i][k] = false;
        }
      }
    } else {
      for (j = 0; j < this.allMeals.length; j++) {
        this.mealIsExpanded[j] = false;
        if (this.allMeals[j].allergens) {
          for (k = 0; k < this.allMeals[j].allergens.length; k++) {
            this.allergenIsExpanded[j][k] = false;
          }
        }
      }
      this.mealIsExpanded[i] = true;
    }
  }

  expandAllergen(i,j) {
    var k;
    if (this.allergenIsExpanded[i][j]) {
      this.allergenIsExpanded[i][j] = false;
    } else {
      if (this.allMeals[i].allergens) {
        for (k = 0; k < this.allMeals[i].allergens.length; k++) {
          this.allergenIsExpanded[i][k] = false;
        }
        this.allergenIsExpanded[i][j] = true;
      }
    }
  }

  formatPrices(number:number) {
    return number.toFixed(2) + " €";
  }

  pickDate($event) {
    setTimeout(() => {
      this.showBasicCalendar = false;
    }, 100);

    this.noMealsForDate = true;

    var i;
    for (i = 0; i < this.allMeals.length; i++) {
      var mealDate;
      if (this.allMeals[i].date) {
        mealDate = moment(this.allMeals[i].date);
      } else { mealDate = moment(); }

      if ($event.format('MM DD YYYY') == mealDate.format('MM DD YYYY')) {
        this.mealForDate[i] = true;
        this.noMealsForDate = false;
      } else { this.mealForDate[i] = false; }
    }
  }

  veganOnly() {
    this.onlyVeganFood = !this.onlyVeganFood;
    this.onlyVeggieFood = false;

    this.noMealsForDate = true;
    var i;
    for (i = 0; i < this.allMeals.length; i++) {
      if (this.checkConditions(i)) {
        this.noMealsForDate = false;
      }
    }
  }

  vegetarianOnly() {
    this.onlyVeggieFood = !this.onlyVeggieFood;
    this.onlyVeganFood = false;

    this.noMealsForDate = true;
    var i;
    for (i = 0; i < this.allMeals.length; i++) {
      if (this.checkConditions(i)) {
        this.noMealsForDate = false;
      }
    }
  }

  checkConditions(i) {
    if (this.mealForDate[i]) {
      if (this.onlyVeganFood) {
        if (this.mealIsVegan[i]) {
          return true;
        } else if (this.onlyVeggieFood) {
          if (this.mealIsVegetarian[i]) {
            return true;
          } else { return false; }
        }
      } else if (this.onlyVeggieFood) {
        if (this.mealIsVegetarian[i] || this.mealIsVegan[i]) {
          return true;
        } else { return false; }
      } else { return true; }
    } else { return false; }
  }

  getWeekdays():string[] {
    if (this.translate.currentLang == 'de') {
      return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    } else { return ['S', 'M', 'T', 'W', 'T', 'F', 'S']; }
  }

  swipeCampus(event) {
    if (Math.abs(event.deltaY) < 50) {
      if (event.deltaX > 0) {
        // user swiped from left to right
        this.swipeEvent.publish('campus-swipe-to-right', this.campus);
      } else if (event.deltaX < 0) {
        // user swiped from right to left
        this.swipeEvent.publish('campus-swipe-to-left', this.campus);
      }
    }
  }

  isInArray(array, value) { // checks if value is in array
    var i;
    var found = false;
    for (i = 0; i < array.length; i++) {
      if (array[i] == value) {
        found = true;
      }
    }
    return found;
  }

}
