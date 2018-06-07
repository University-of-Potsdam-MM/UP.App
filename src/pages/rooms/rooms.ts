import {Component} from '@angular/core';
import {IonicPage} from 'ionic-angular';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams} from "@angular/common/http";
import {WebHttpUrlEncodingCodec} from "../../providers/login-provider/lib";
import {IConfig, IRoomRequest, IRoomRequestResponse} from "../../library/interfaces";
import {Storage} from "@ionic/storage";
import {ToastController} from 'ionic-angular';

/**
 * Generated class for the RoomsPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-rooms',
  templateUrl: 'rooms.html',
})
export class RoomsPage {

  //bindings
  segment_locations: string;
  select_timeslot: string;
  refresher: any;

  //vars
  roomsFound: String[] = [];
  time_slots: any;
  current_timeslot: any;
  current_location: string;
  error: HttpErrorResponse;

  constructor(
    private storage: Storage,
    public http: HttpClient) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad RoomsPage');

    this.current_timeslot = RoomsPage.getCurrentTimeslot();

    this.time_slots = [];
    for (let i = 8; i < 22; i = i + 2) {
      let slot = {"lbl": i + " - " + (i + 2) + " Uhr", "value": i};// TODO localize
      this.time_slots.push(slot)
    }
    this.select_timeslot = this.current_timeslot.start;

    this.segment_locations = RoomsPage.getLocationByNum(this.current_location);
    this.switchLocation("3"); // TODO load default tab from user settings/history
  }

  /**
   * Convert campus number to short string (for localization)
   * @param num - Campus number (1-3)
   * @returns {string} - campus short string (gs,np,go), defaults to gs
   */
  static getLocationByNum(num) { // one could use numbers everywhere, but this is better for readability
    switch (num) {
      case "1": {
        return "np"
      }
      case "2": {
        return "go"
      }
      case "3": {
        return "gs"
      }
      default: {
        return "gs"
      }
    }
  }

  /**
   * gets the slot start and end time for the current time
   * @returns {{start: number; end: number; error: boolean}} - start/end hour, error = true when out of bounds (8-22)
   */
  static getCurrentTimeslot() {
    let now = new Date();

    for (let i = 8; i < 22; i = i + 2) {
      let start = new Date();
      start.setHours(i);
      let end = new Date();
      end.setHours((i + 2));

      if (start <= now && end > now) {
        return {"start": i, "end": (i + 2), "error": false}
      }
    }

    return {"start": 8, "end": 10, "error": true} //TODO handle error wherever this is used
  }

  async refreshRoom(refresher) {
    this.getRoomInfo();
    this.refresher = refresher
  }

  switchLocation(location){
    this.current_location = location;
    this.getRoomInfo()
  }

  changeTimeSlot(bla){
    this.current_timeslot =  {"start":this.select_timeslot, "end": (this.select_timeslot + 2),"error":false};
    this.getRoomInfo();
  }

  async getRoomInfo() {
    let location = this.current_location;

    let config: IConfig = await this.storage.get("config");

    let roomRequest: IRoomRequest = {
      authToken: config.authorization.credentials.accessToken,
    };

    let url = "https://apiup.uni-potsdam.de/endpoints/roomsAPI/1.0/rooms4Time?";

    let headers: HttpHeaders = new HttpHeaders()
      .append("Authorization", roomRequest.authToken);

    let start = new Date();
    let end = new Date();
    start.setHours(this.current_timeslot.start);
    end.setHours(this.current_timeslot.end);

    let params: HttpParams = new HttpParams({encoder: new WebHttpUrlEncodingCodec()})
      .append("format", "json")
      .append("startTime", start.toISOString())
      .append("endTime", end.toISOString())
      .append("campus", location);

    this.http.get(url, {headers: headers, params: params}).subscribe(
      (response: IRoomRequestResponse) => {
        this.roomsFound = [];
        this.error = null;
        for (let room of response.rooms4TimeResponse.return) {
          this.roomsFound.push(room);
        }
        if (this.refresher != null) {
          this.refresher.complete()
        }
      },
      (error: HttpErrorResponse) => {
        console.log(error);
        this.error = error;
        this.roomsFound = [];
        if (this.refresher != null) {
          this.refresher.complete()
        }
      }
    );

  }

}
