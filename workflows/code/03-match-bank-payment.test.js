'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {matchReservation,checkEligibility,assertPaymentSafetyCapability,interpretRegistration,reviewEmail}=require('./03-match-bank-payment');
const today='2026-10-27';
const reservation={id:1,cliente:'Carmen Ruiz',producto:'Zueco sanitario',talla:'38',estado:'activo',pendiente:20,
 fecha_limite:'2026-12-01',telefono:'600000000',email:'test@example.test'};
const payment={ordenante:'CARMEN RUIZ GARCIA',importe:10,concepto:'zuecos',tipo:'bizum'};
test('clear name and eligible API amounts permit exactly one reservation',()=>{
 const result=matchReservation(payment,[reservation],today);
 assert.equal(result.decision,'register');assert.equal(result.reservation.id,1);
});
test('overpayment, overdue and terminal reservations go to human review',()=>{
 for(const change of [{pendiente:5},{fecha_limite:'2026-10-26'},{estado:'liquidado'},{estado:'vencido'}])
 assert.equal(matchReservation(payment,[{...reservation,...change}],today).decision,'review');
 assert.equal(checkEligibility({...reservation,fecha_limite:today},payment,today),null);
});
test('balance elimination cannot turn ambiguous identity into an automatic payment',()=>{
 const result=matchReservation(payment,[{...reservation,pendiente:5},{...reservation,id:2}],today);
 assert.equal(result.decision,'review');assert.equal(result.candidates.length,2);
});
test('explicit reference cannot redirect overpayment to a different reservation',()=>{
 const result=matchReservation({...payment,concepto:'apartado 1'},[{...reservation,pendiente:5},{...reservation,id:2}],today);
 assert.equal(result.decision,'review');assert.deepEqual(result.candidates.map(r=>r.id),[1]);
 assert.equal(matchReservation({...payment,concepto:'apartado 99'},[reservation],today).decision,'review');
 assert.equal(matchReservation({...payment,concepto:'apartado 1 y apartado 2'},[reservation],today).decision,'review');
});
test('explicit reference with incompatible payer needs review',()=>{
 assert.equal(matchReservation({...payment,ordenante:'JORGE M.',concepto:'apartado 1'},[reservation],today).decision,'review');
});
test('abbreviated name requires matching product, and normalized names preserve accents semantics',()=>{
 const laura={...reservation,cliente:'Laura Ortega',producto:'Deportiva blanca'};
 assert.equal(matchReservation({...payment,ordenante:'LAURA O.',concepto:'deportivas'},[laura],today).decision,'register');
 assert.equal(matchReservation({...payment,ordenante:'LAURA O.',concepto:'botas'},[laura],today).decision,'review');
 assert.equal(matchReservation({...payment,ordenante:'LUCIA GOMEZ PEREZ'},[{...reservation,cliente:'Lucía Gómez'}],today).decision,'register');
});
test('missing concept includes candidate contacts without registering',()=>{
 const result=matchReservation({...payment,ordenante:'ROMERO D',concepto:''},[{...reservation,cliente:'David Romero'}],today);
 assert.equal(result.decision,'review');assert.equal(result.candidates.length,1);
 const notice=reviewEmail({...result,payment});assert.match(notice.body,/test@example.test/);
});
test('old shop versions cannot authorize a financial write',()=>{
 assert.throws(()=>assertPaymentSafetyCapability({statusCode:200,body:{paths:{}}}),/protección/);
 const operation={parameters:[{in:'header',name:'Idempotency-Key'},{in:'header',name:'Payment-Notice-Fingerprint'}]};
 assert.doesNotThrow(()=>assertPaymentSafetyCapability({statusCode:200,body:{paths:{'/api/apartados/{apartado_id}/abonos':{post:operation}}}}));
});
test('uncertain network response never authorizes retry and reaches explicit review',()=>{
 const context={reservation,payment,candidates:[reservation]};
 assert.equal(interpretRegistration({statusCode:201,body:reservation},context).decision,'registered');
 for(const statusCode of [404,409,422]) assert.equal(interpretRegistration({statusCode,body:{detail:'Revisar'}},context).decision,'review');
 const uncertain=interpretRegistration({error:'network'},context);
 assert.equal(uncertain.decision,'uncertain');assert.equal(uncertain.registration_allowed,false);
 assert.match(reviewEmail(uncertain).body,/No registrar manualmente/);
});
