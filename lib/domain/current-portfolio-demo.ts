import { randomUUID } from "node:crypto";

export type DemoProperty = { id:string; address:string; city:string; region:string; postalCode:string; notes:string };
export type DemoUnit = { id:string; propertyId:string; name:string };
export type DemoTenant = { id:string; fullName:string; notes:string };
export type DemoLease = { id:string; propertyId:string; unitId:string; tenantId:string; rentCents:number; dueDay:number; startDate:string };
export type DemoCharge = { id:string; propertyId:string; unitId:string; leaseId:string; tenantId:string; chargeType:"rent"|"utility"|"adjustment"; description:string; amountCents:number; effectiveDate:string; dueDate:string; importBatchId:string };
export type DemoPayment = { id:string; propertyId:string; tenantId:string; payerName:string; amountCents:number; receivedDate:string; method:"ach"|"check"|"zelle"|"venmo"|"other"; reference:string; notes:string; importBatchId:string };
export type DemoAllocation = { id:string; paymentId:string; chargeId:string; amountCents:number; importBatchId:string };
export type DemoReviewItem = { id:string; importBatchId:string; issueType:"rent_mismatch"|"occupancy"|"identity"|"invalid_date"|"balance_gap"; subject:string; detail:string };

export type CurrentPortfolioDemoPlan = {
  importBatchId:string;
  properties:DemoProperty[];
  units:DemoUnit[];
  tenants:DemoTenant[];
  leases:DemoLease[];
  charges:DemoCharge[];
  payments:DemoPayment[];
  allocations:DemoAllocation[];
  reviewItems:DemoReviewItem[];
};

type SourceEntry = { rent:number; utility:number; received:number|null; receivedDate:string|null };
type SourceMonth = { period:string; entries:Record<string,SourceEntry> };

const ROSTER = [
  ["2 Water Wheel Dr","Aaron Dunn",825],
  ["4 Water Wheel Dr","Donna Price",755],
  ["6 Water Wheel Dr","Elisha Leaf",875],
  ["8 Water Wheel Dr","Howard Merchant",850],
  ["10 Water Wheel Dr","Destiny Bryant",850],
  ["12 Water Wheel Dr","Mauro Sanchez",850],
  ["2 Sun Valley Cir","Kyrsten Nicodemus",825],
  ["4 Sun Valley Cir","Xitlaly Flores",800],
  ["6 Sun Valley Cir","Mauricio Rebollo",495],
  ["8 Sun Valley Cir","Edilsar Perez Vasquez",900],
  ["10 Sun Valley Cir","Matt Mackie",805],
  ["39 Sun Valley Cir","Jessica Greene",765],
  ["2 East Park Dr","Enieda Mendoza",800],
  ["4 East Park Dr","Toby Dunn",450],
  ["479 Walnut St","Sue Bubbel",495],
  ["2665 Telegraph Rd","Armondo Santoyo",1450],
  ["87 Twin Lakes Dr","Jessica Garcia",1375],
] as const;

const MASKED_NAMES = [
  "R. Alvarez","M. Bennett","K. Chen","D. Fowler","T. Grant","S. Hayes","J. Ibarra","L. Jensen","P. Kowal",
  "N. Lima","C. Moss","A. Nunez","E. Okafor","B. Pratt","V. Quinn","H. Reyes","W. Sato",
] as const;

const OPENING:Record<string,number> = { "Sue Bubbel":120.74 };

const SOURCE_MONTHS:SourceMonth[] = [
  {period:"2026-03",entries:{
    "Aaron Dunn":{rent:825,utility:145.31,received:971,receivedDate:"2026-03-04"},"Donna Price":{rent:755,utility:112.55,received:868,receivedDate:"2026-03-05"},
    "Elisha Leaf":{rent:875,utility:128.93,received:997,receivedDate:"2026-03-12"},"Howard Merchant":{rent:850,utility:126.20,received:976.20,receivedDate:"2026-02-28"},
    "Destiny Bryant":{rent:850,utility:47.03,received:932,receivedDate:"2026-03-04"},"Mauro Sanchez":{rent:850,utility:50,received:900,receivedDate:"2026-03-02"},
    "Kyrsten Nicodemus":{rent:850,utility:134.39,received:985,receivedDate:"2026-03-06"},"Xitlaly Flores":{rent:800,utility:0,received:null,receivedDate:null},
    "Mauricio Rebollo":{rent:495,utility:145.31,received:640.31,receivedDate:"2026-03-01"},"Edilsar Perez Vasquez":{rent:900,utility:0,received:900,receivedDate:"2026-02-25"},
    "Matt Mackie":{rent:805,utility:128.93,received:1030,receivedDate:"2026-03-03"},"Jessica Greene":{rent:765,utility:101.63,received:871.63,receivedDate:"2026-03-10"},
    "Enieda Mendoza":{rent:800,utility:126.20,received:926.20,receivedDate:"2026-03-02"},"Toby Dunn":{rent:450,utility:101.63,received:420.74,receivedDate:"2026-03-08"},
    "Sue Bubbel":{rent:495,utility:153.50,received:500,receivedDate:"2026-03-10"},"Armondo Santoyo":{rent:1450,utility:0,received:1450,receivedDate:"2026-03-02"},
    "Jessica Garcia":{rent:1375,utility:0,received:1375,receivedDate:"2026-03-01"},
  }},
  {period:"2026-04",entries:{
    "Aaron Dunn":{rent:825,utility:123.47,received:950,receivedDate:"2026-04-06"},"Donna Price":{rent:755,utility:115.28,received:870,receivedDate:"2026-04-06"},
    "Elisha Leaf":{rent:875,utility:128.93,received:1004,receivedDate:"2026-04-06"},"Howard Merchant":{rent:850,utility:90.71,received:940.71,receivedDate:"2026-04-05"},
    "Destiny Bryant":{rent:850,utility:47.03,received:923,receivedDate:"2026-04-06"},"Mauro Sanchez":{rent:850,utility:47.03,received:900,receivedDate:"2026-04-06"},
    "Kyrsten Nicodemus":{rent:825,utility:148.04,received:1000,receivedDate:"2026-04-06"},"Xitlaly Flores":{rent:825,utility:0,received:825,receivedDate:"2026-04-06"},
    "Mauricio Rebollo":{rent:495,utility:104.36,received:599.36,receivedDate:"2026-04-06"},"Edilsar Perez Vasquez":{rent:900,utility:74.33,received:975,receivedDate:"2026-04-06"},
    "Matt Mackie":{rent:805,utility:81.17,received:1000,receivedDate:"2026-04-06"},"Jessica Greene":{rent:765,utility:96.17,received:856.17,receivedDate:"2026-04-03"},
    "Enieda Mendoza":{rent:800,utility:47.03,received:928.23,receivedDate:"2026-04-07"},"Toby Dunn":{rent:450,utility:128.93,received:null,receivedDate:null},
    "Sue Bubbel":{rent:495,utility:87.98,received:550,receivedDate:"2026-04-29"},
  }},
  {period:"2026-05",entries:{
    "Aaron Dunn":{rent:825,utility:139.85,received:965,receivedDate:"2026-05-05"},"Donna Price":{rent:755,utility:134.39,received:889.39,receivedDate:"2026-05-01"},
    "Elisha Leaf":{rent:875,utility:125,received:1003,receivedDate:"2026-05-06"},"Howard Merchant":{rent:850,utility:126.20,received:980,receivedDate:"2026-05-01"},
    "Destiny Bryant":{rent:850,utility:74.33,received:950.50,receivedDate:"2026-05-01"},"Mauro Sanchez":{rent:850,utility:74.33,received:925,receivedDate:"2026-05-05"},
    "Kyrsten Nicodemus":{rent:825,utility:180.80,received:500,receivedDate:"2026-05-05"},"Xitlaly Flores":{rent:800,utility:49.76,received:1225,receivedDate:"2026-05-01"},
    "Mauricio Rebollo":{rent:495,utility:98.90,received:null,receivedDate:null},"Edilsar Perez Vasquez":{rent:900,utility:112.55,received:1012,receivedDate:"2026-05-05"},
    "Matt Mackie":{rent:805,utility:128.93,received:1000,receivedDate:"2026-05-01"},"Jessica Greene":{rent:765,utility:107.09,received:857.09,receivedDate:"2026-05-01"},
    "Enieda Mendoza":{rent:800,utility:148.04,received:948.04,receivedDate:"2026-05-05"},"Toby Dunn":{rent:800,utility:68.87,received:null,receivedDate:null},
    "Sue Bubbel":{rent:495,utility:115.28,received:null,receivedDate:null},
  }},
];

const REVIEW_SOURCE = [
  ["rent_mismatch","Kyrsten Nicodemus","Lease says $825.00; the first imported month billed $850.00."],
  ["rent_mismatch","Toby Dunn","Lease says $450.00; the latest imported month billed $800.00 with no recorded change."],
  ["rent_mismatch","Xitlaly Flores","Imported rent alternates between $800.00 and $825.00."],
  ["rent_mismatch","Aaron Dunn","The tenant roster and an earlier billing sheet disagree on rent."],
  ["rent_mismatch","Donna Price","The tenant roster and an earlier billing sheet disagree on rent."],
  ["rent_mismatch","Elisha Leaf","The tenant roster and an earlier billing sheet disagree on rent."],
  ["occupancy","Matt Mackie","Billed through the latest imported month, then absent from a later sheet. Confirm current occupancy."],
  ["occupancy","Armondo Santoyo","Billed through the latest imported month, then absent from a later sheet. Confirm current occupancy."],
  ["occupancy","Jessica Garcia","Billed through the latest imported month, then absent from a later sheet. Confirm current occupancy."],
  ["identity","Donna Price","The name is misspelled on one sheet and would otherwise import as a second person."],
  ["identity","Matt Mackie","A suffix appears on one sheet but not the tenant roster."],
  ["identity","Edilsar Perez Vasquez","The surname is spelled differently on one sheet."],
  ["identity","Howard Merchant","A different tenant name appears at this address on one sheet."],
  ["invalid_date","Kyrsten Nicodemus","One payment date is malformed and cannot be trusted without review."],
  ["balance_gap","Aaron Dunn","An earlier sheet leaves an outstanding balance that the next month does not carry forward."],
  ["occupancy","Xitlaly Flores","The address was billed for multiple months before a tenant name appeared."],
] as const;

function cents(value:number):number { return Math.round(value*100); }
function iso(date:Date):string { return date.toISOString().slice(0,10); }
function monthAt(asOf:Date,offset:number):Date { return new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()+offset,1)); }
function dateAt(month:Date,day:number):string { return iso(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(day,28)))); }
function monthLabel(month:Date):string { return month.toLocaleString("en-US",{month:"long",year:"numeric",timeZone:"UTC"}); }

function rebaseReceivedDate(sourceDate:string,sourcePeriod:string,targetMonth:Date):string {
  const [sy,sm,sd]=sourceDate.split("-").map(Number);
  const [py,pm]=sourcePeriod.split("-").map(Number);
  const sourceIndex=sy*12+(sm-1), periodIndex=py*12+(pm-1);
  return dateAt(monthAt(targetMonth,sourceIndex-periodIndex),sd);
}

export function buildCurrentPortfolioDemoPlan(
  asOf:Date,
  options:{showRealTenantNames?:boolean;idFactory?:()=>string}={},
):CurrentPortfolioDemoPlan {
  const idFactory=options.idFactory??randomUUID;
  const showReal=options.showRealTenantNames===true;
  const importBatchId=idFactory();
  const properties:DemoProperty[]=[],units:DemoUnit[]=[],tenants:DemoTenant[]=[],leases:DemoLease[]=[];
  const charges:DemoCharge[]=[],payments:DemoPayment[]=[],allocations:DemoAllocation[]=[];
  const leaseByRealName=new Map<string,DemoLease>();
  const displayNameByRealName=new Map<string,string>();
  const firstTargetMonth=monthAt(asOf,-2);
  const leaseStart=iso(monthAt(asOf,-14));

  ROSTER.forEach(([address,realName,rent],index)=>{
    const propertyId=idFactory(),unitId=idFactory(),tenantId=idFactory(),leaseId=idFactory();
    const displayName=showReal?realName:MASKED_NAMES[index];
    displayNameByRealName.set(realName,displayName);
    properties.push({id:propertyId,address,city:"Mill Creek Manor",region:"MI",postalCode:"48XXX",notes:"Current portfolio demo source · postal code is masked for the sales demo"});
    units.push({id:unitId,propertyId,name:"House"});
    tenants.push({id:tenantId,fullName:displayName,notes:showReal?"Current tenant seed approved for controlled demo use":"Tenant name masked for public sales demo"});
    const lease={id:leaseId,propertyId,unitId,tenantId,rentCents:cents(rent),dueDay:1,startDate:leaseStart};
    leases.push(lease); leaseByRealName.set(realName,lease);
  });

  for(const [realName,amount] of Object.entries(OPENING)){
    const lease=leaseByRealName.get(realName)!;
    charges.push({id:idFactory(),propertyId:lease.propertyId,unitId:lease.unitId,leaseId:lease.id,tenantId:lease.tenantId,chargeType:"adjustment",description:"Opening balance carried from prior history",amountCents:cents(amount),effectiveDate:dateAt(monthAt(firstTargetMonth,-1),1),dueDate:dateAt(monthAt(firstTargetMonth,-1),1),importBatchId});
  }

  SOURCE_MONTHS.forEach((sourceMonth,monthIndex)=>{
    const targetMonth=monthAt(asOf,monthIndex-2);
    const periodStart=dateAt(targetMonth,1);
    for(const [realName,entry] of Object.entries(sourceMonth.entries)){
      const lease=leaseByRealName.get(realName);
      if(!lease) throw new Error(`Unknown seeded tenant: ${realName}`);
      const rentCharge:DemoCharge={id:idFactory(),propertyId:lease.propertyId,unitId:lease.unitId,leaseId:lease.id,tenantId:lease.tenantId,chargeType:"rent",description:`Rent — ${monthLabel(targetMonth)}`,amountCents:cents(entry.rent),effectiveDate:periodStart,dueDate:periodStart,importBatchId};
      charges.push(rentCharge);
      if(entry.utility>0) charges.push({id:idFactory(),propertyId:lease.propertyId,unitId:lease.unitId,leaseId:lease.id,tenantId:lease.tenantId,chargeType:"utility",description:`Water / trash — ${monthLabel(targetMonth)}`,amountCents:cents(entry.utility),effectiveDate:periodStart,dueDate:periodStart,importBatchId});
      if(entry.received!==null&&entry.received>0){
        const rebasedReceivedDate=rebaseReceivedDate(entry.receivedDate!,sourceMonth.period,targetMonth);
        const payment:DemoPayment={id:idFactory(),propertyId:lease.propertyId,tenantId:lease.tenantId,payerName:displayNameByRealName.get(realName)!,amountCents:cents(entry.received),receivedDate:rebasedReceivedDate>iso(asOf)?iso(asOf):rebasedReceivedDate,method:monthIndex===2?"zelle":monthIndex===1?"ach":"other",reference:`IMPORT-${sourceMonth.period}-${lease.id.slice(0,8)}`,notes:"Imported current-portfolio payment pattern",importBatchId};
        payments.push(payment);
        let remaining=payment.amountCents;
        const openCharges=charges.filter(charge=>charge.leaseId===lease.id).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||Number(a.chargeType!=="rent")-Number(b.chargeType!=="rent")||a.id.localeCompare(b.id));
        for(const charge of openCharges){
          if(remaining<=0) break;
          const used=allocations.filter(item=>item.chargeId===charge.id).reduce((sum,item)=>sum+item.amountCents,0);
          const room=charge.amountCents-used;
          if(room<=0) continue;
          const amount=Math.min(room,remaining);
          allocations.push({id:idFactory(),paymentId:payment.id,chargeId:charge.id,amountCents:amount,importBatchId});
          remaining-=amount;
        }
      }
    }
  });

  for(const lease of leases){
    const leaseCharges=charges.filter(charge=>charge.leaseId===lease.id).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||Number(a.chargeType!=="rent")-Number(b.chargeType!=="rent")||a.id.localeCompare(b.id));
    const leasePayments=payments.filter(payment=>payment.tenantId===lease.tenantId);
    for(const payment of leasePayments){
      let remaining=payment.amountCents-allocations.filter(item=>item.paymentId===payment.id).reduce((sum,item)=>sum+item.amountCents,0);
      if(remaining<=0) continue;
      for(const charge of leaseCharges){
        if(remaining<=0) break;
        if(charge.dueDate<payment.receivedDate) continue;
        const used=allocations.filter(item=>item.chargeId===charge.id).reduce((sum,item)=>sum+item.amountCents,0);
        const room=charge.amountCents-used;
        if(room<=0) continue;
        const amount=Math.min(room,remaining);
        allocations.push({id:idFactory(),paymentId:payment.id,chargeId:charge.id,amountCents:amount,importBatchId});
        remaining-=amount;
      }
    }
  }

  const reviewItems:DemoReviewItem[]=REVIEW_SOURCE.map(([issueType,realName,detail])=>({
    id:idFactory(),importBatchId,issueType,subject:displayNameByRealName.get(realName)??realName,detail,
  }));
  return {importBatchId,properties,units,tenants,leases,charges,payments,allocations,reviewItems};
}

export function summarizeCurrentPortfolioPlan(plan:CurrentPortfolioDemoPlan):{totalOwedCents:number;creditHeldCents:number;netPositionCents:number} {
  let totalOwedCents=0,creditHeldCents=0;
  for(const lease of plan.leases){
    const chargeIds=new Set(plan.charges.filter(charge=>charge.leaseId===lease.id).map(charge=>charge.id));
    const charged=plan.charges.filter(charge=>charge.leaseId===lease.id).reduce((sum,charge)=>sum+charge.amountCents,0);
    const applied=plan.allocations.filter(item=>chargeIds.has(item.chargeId)).reduce((sum,item)=>sum+item.amountCents,0);
    const balance=charged-applied;
    if(balance>0) totalOwedCents+=balance;
    const paymentIds=new Set(plan.payments.filter(payment=>payment.tenantId===lease.tenantId).map(payment=>payment.id));
    const paid=plan.payments.filter(payment=>paymentIds.has(payment.id)).reduce((sum,payment)=>sum+payment.amountCents,0);
    const allocated=plan.allocations.filter(item=>paymentIds.has(item.paymentId)).reduce((sum,item)=>sum+item.amountCents,0);
    if(paid>allocated) creditHeldCents+=paid-allocated;
  }
  return {totalOwedCents,creditHeldCents,netPositionCents:totalOwedCents-creditHeldCents};
}
