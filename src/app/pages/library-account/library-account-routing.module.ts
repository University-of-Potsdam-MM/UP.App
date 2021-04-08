import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LibraryAccountPage } from './library-account.page';

const routes: Routes = [
  {
    path: '',
    component: LibraryAccountPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LibraryAccountPageRoutingModule {}
