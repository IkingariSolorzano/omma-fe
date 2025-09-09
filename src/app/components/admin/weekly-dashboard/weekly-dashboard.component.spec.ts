import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyDashboardComponent } from './weekly-dashboard.component';

describe('WeeklyDashboardComponent', () => {
  let component: WeeklyDashboardComponent;
  let fixture: ComponentFixture<WeeklyDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeeklyDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
