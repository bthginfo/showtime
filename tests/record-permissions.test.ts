import {describe,expect,it} from 'vitest';
import {canManageRecord} from '@/shared/record-permissions';
import {memberFixture} from './access-fixture';
const employee=memberFixture('member'),leader=memberFixture('leader',['team_lead']);
const own={createdBy:'member',departmentId:'makeup',data:{userId:'member'}};
const other={createdBy:'other',departmentId:'makeup',data:{userId:'other'}};
describe('scoped theater working permissions',()=>{
 it('employees create their own shared work; managing other work needs a team role',()=>{
  for(const kind of ['tasks','looks','templates','maskPlans'] as const){
   expect(canManageRecord(employee,kind,own)).toBe(true);
   expect(canManageRecord(employee,kind,other)).toBe(false);
   expect(canManageRecord(leader,kind,other)).toBe(true);
  }
  for(const kind of ['productions','casting','characters','people','actors','materials','sprints','categories','calendarCategories'] as const)expect(canManageRecord(employee,kind)).toBe(false);
 });
 it('own calendar changes remain available; team planning needs scope',()=>{
  expect(canManageRecord(employee,'events')).toBe(true);
  expect(canManageRecord(employee,'events',{...own,data:{participantIds:['member']}})).toBe(true);
  for(const data of [{participantIds:['other']},{participantIds:['member','other']},{}]){
   expect(canManageRecord(employee,'events',{...other,data})).toBe(false);
   expect(canManageRecord(leader,'events',{...other,data})).toBe(true);
   expect(canManageRecord(leader,'events',{...other,departmentId:'sound',data})).toBe(false);
  }
 });
 it('every own time booking is correctable; team editing is scoped and explicit',()=>{
  for(const kind of ['time','attendance'] as const){
   expect(canManageRecord(employee,kind,own)).toBe(true);
   expect(canManageRecord(employee,kind,other)).toBe(false);
   expect(canManageRecord(leader,kind,other)).toBe(true);
   expect(canManageRecord(leader,kind,{...other,departmentId:'sound'})).toBe(false);
  }
  expect(canManageRecord(leader,'leave',other)).toBe(false);
 });
 it('administration never grants private conversation or personal-message access',()=>{
  const admin=memberFixture('admin',['theater_admin']);
  expect(canManageRecord(admin,'time',other)).toBe(false);
  expect(canManageRecord(admin,'messages',{...other,data:{userId:'other',conversationId:'private'}})).toBe(false);
  expect(canManageRecord(admin,'conversations',{...other,data:{mode:'group'}})).toBe(false);
  expect(canManageRecord(admin,'feedback',other)).toBe(false);
 });
 it('protected workflows have no generic write permission',()=>{
  expect(canManageRecord(leader,'events',{...own,data:{leaveId:'request'}})).toBe(false);
  for(const kind of ['timesheets','notifications','files','shiftSwaps'] as const)expect(canManageRecord(leader,kind)).toBe(false);
 });
});
