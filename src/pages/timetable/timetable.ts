import {Component } from '@angular/core';
import {
  IonicPage, ModalController,
  NavController, NavParams, ViewController
} from 'ionic-angular';
import { Storage } from "@ionic/storage";
import { ISession } from "../../providers/login-provider/interfaces";
import { IPulsAPIResponse_getStudentCourses } from "../../library/interfaces_PULS";
import {LoginPage} from "../login/login";
import {createEventSource, IEventObject,} from "./createEvents";
import {ITimeSelected} from "ionic2-calendar/calendar";
import * as moment from 'moment';
import {PulsProvider} from "../../providers/puls/puls";


function debug(text){
  console.log(`[TimetablePage]: ${text}`);
}

@IonicPage()
@Component({
  selector: 'page-timetable',
  templateUrl: 'timetable.html',
})
export class TimetablePage {

  eventSource:IEventObject[] = [];

  // title string that should be displayed for every mode, eg. "24.12.2018"
  currentTitle = "";

  // options for ionic2-calendar component
  calendarOptions = {
    calendarMode: "week",
    currentDate: new Date(),
    locale: "de",
    startingDayWeek: 1,
    startingDayMonth: 1,
    startHour: "8",
    endHour: "20",
    step: "15",
    timeInterval: "120",
    showEventDetail: false,
    autoSelect: false,
    dateFormatter:{
      formatMonthViewDayHeader: function(date:Date) {
        return 'testMDH';
      },
      formatWeekViewDayHeader: function(date:Date) {
        return 'testWDH';
      },
      formatDayViewHourColumn: function(date:Date) {
        return 'testDH';
      },
      formatWeekViewHourColumn: function(date:Date) {
        return 'testWH';
      },
      formatMonthViewTitle: function(date:Date) {
        return 'testMT';
      },
      formatDayViewTitle: function(date:Date) {
        return 'testDT';
      }
    }
  };

  constructor(
      public navCtrl: NavController,
      private storage:Storage,
      private modalCtrl:ModalController,
      private puls:PulsProvider) {
  }

  ionViewDidLoad(){
    // TODO: check connections
    this.storage.get("session").then(
      (session:ISession) => {
        // check if we have a session
        if(session === null){
          // in case there is no session send the user to LoginPage
          this.navCtrl.push(LoginPage).then(
            () => debug("pushed LoginPage")
          )
        } else {
          // there is a session
          this.puls.getStudentCourses(session).subscribe(
            (response:IPulsAPIResponse_getStudentCourses) => {
              this.eventSource = createEventSource(
                response.studentCourses.student.actualCourses.course
              );
            }
          );
        }
      }
    );
  }

  /* ~~~ ionic2-calendar specific methods ~~~ */

  /**
   * simply changes the calendarMode
   * @param mode
   */
  changeCalendarMode(mode){
    this.calendarOptions.calendarMode = mode;
  }

  /**
   * triggered when event is selected in any other view than monthView. Then
   * a modal with information about the event is shown.
   * @param event
   */
  eventSelected(event:IEventObject){
    if(this.calendarOptions.calendarMode != "month"){
      let eventModal = this.modalCtrl.create(
        EventModal,
        {events: [event], date: event.startTime}
      );
      eventModal.present();
    }
  }

  /**
   * triggred when a time is clicked. Here a modal is shown when a time is
   * clicked in monthView and there are events at this timeslot.
   * @param time
   */
  timeSelected(time:ITimeSelected) {
    if(this.calendarOptions.calendarMode == "month" && time.events.length > 0) {
      let eventModal = this.modalCtrl.create(
        EventModal, {events: time.events, date: time.selectedTime}
      );
      eventModal.present();
    }
  }

  /**
   * simply changes the current views title when month/week/day is changed
   * @param title
   */
  titleChanged(title){
    this.currentTitle= title;
  }
}


/**
 * Component for the modal to be shown when an event is selected
 */
@Component({
  selector: 'event',
  templateUrl: 'eventModal.html',
})
export class EventModal {

  isArray = Array.isArray;
  moment = moment;

  events:IEventObject[] = null;
  date = null;

  constructor(private params: NavParams,
              private view:ViewController) {
    this.events = this.params.get('events');
    this.date = this.params.get('date');
  }

  closeModal(){
    this.view.dismiss();
  }
}
