const {analyzeMeters}=require('../services/riskEngine');
const meter={id:1,meter_id:'A',consumer_name:'A',connection_type:'Residential',sanctioned_load_kw:5,status:'Active'};
const run=(values,extra=[],m=meter)=>analyzeMeters([m,...extra],[...values.map(([month,units])=>({meterId:1,month,units})),...(extra.length?[]:[])]).at(-1);
test('detects sudden drop',()=>expect(run([['2025-01',100],['2025-02',50]]).flags).toContain('SUDDEN_DROP'));
test('detects sudden spike',()=>expect(run([['2025-01',100],['2025-02',170]]).flags).toContain('SUDDEN_SPIKE'));
test('detects zero consumption',()=>expect(run([['2025-01',0]]).flags).toContain('ZERO_CONSUMPTION'));
test('detects low load for industrial connections',()=>expect(run([['2025-01',10]],[],{...meter,connection_type:'Industrial',sanctioned_load_kw:10}).flags).toContain('LOW_FOR_LOAD'));
test('detects consistent decline',()=>expect(run([['2025-01',100],['2025-02',90],['2025-03',80],['2025-04',70]]).flags).toContain('CONSISTENT_DECLINE'));
test('caps combined rule weights at 100',()=>{const meters=[{...meter,connection_type:'Industrial',sanctioned_load_kw:20},...Array.from({length:10},(_,i)=>({...meter,id:i+2,meter_id:`P-${i+2}`,connection_type:'Industrial'}))];const rows=[1000,900,800,700,0].map((units,i)=>({meterId:1,month:`2025-0${i+1}`,units}));meters.slice(1).forEach(m=>rows.push({meterId:m.id,month:'2025-05',units:1000}));const result=analyzeMeters(meters,rows).find(x=>x.month==='2025-05'&&x.meterId===1);expect(result.score).toBe(100);expect(result.level).toBe('HIGH')});
test('calculates rolling average from previous months',()=>expect(run([['2025-01',100],['2025-02',200],['2025-03',300],['2025-04',400]]).rollingAvg).toBe(200));
test('detects a peer outlier within the same connection type and month',()=>{
 const meters=Array.from({length:10},(_,i)=>({...meter,id:i+1,meter_id:`M-${i+1}`}));
 const rows=meters.map((m,i)=>({meterId:m.id,month:'2025-01',units:i===9?600:100}));
 expect(analyzeMeters(meters,rows).at(-1).flags).toContain('PEER_OUTLIER');
});
