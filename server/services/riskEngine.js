// Explainable monthly rules keep the demo transparent and easy to discuss.
const DEFAULT_WEIGHTS={SUDDEN_DROP:30,ZERO_CONSUMPTION:25,PEER_OUTLIER:20,LOW_FOR_LOAD:15,CONSISTENT_DECLINE:10,SUDDEN_SPIKE:10};
function analyzeMeters(meters, readings, settings={}) {
 const weights={...DEFAULT_WEIGHTS}, threshold={suddenDrop:40,suddenSpike:60,lowForLoadPercent:10,peerStdDev:2,...settings};
 const all=readings.map(r=>({...r, meterId:Number(r.meterId), units:Number(r.units)}));
 const monthPeers={};
 all.forEach(r=>{const m=meters.find(x=>x.id===r.meterId);if(m)(monthPeers[`${m.connection_type}|${r.month}`]??=[]).push(r.units)});
 const results=[];
 for(const meter of meters){
  const rows=all.filter(r=>r.meterId===meter.id).sort((a,b)=>a.month.localeCompare(b.month));
  rows.forEach((r,i)=>{
   const prev=rows[i-1]; const prior=rows.slice(Math.max(0,i-3),i); const avg=prior.length?prior.reduce((s,x)=>s+x.units,0)/prior.length:null;
   const change=prev&&prev.units!==0?((r.units-prev.units)/prev.units)*100:null;
   const deviation=avg&&avg!==0?((r.units-avg)/avg)*100:null;
   const flags=[], reasons=[];
   if(change!==null&&change < -threshold.suddenDrop){flags.push('SUDDEN_DROP');reasons.push(`Consumption dropped ${Math.abs(change).toFixed(0)}% compared to last month`)}
   if(change!==null&&change > threshold.suddenSpike){flags.push('SUDDEN_SPIKE');reasons.push(`Consumption increased ${change.toFixed(0)}% compared to last month`)}
   if(r.units===0&&meter.status==='Active'){flags.push('ZERO_CONSUMPTION');reasons.push('No consumption recorded while the meter is active')}
   const expected=Number(meter.sanctioned_load_kw)*30*4;
   if(['Commercial','Industrial'].includes(meter.connection_type)&&r.units<expected*threshold.lowForLoadPercent/100){flags.push('LOW_FOR_LOAD');reasons.push(`Consumption is below ${threshold.lowForLoadPercent}% of expected usage for the sanctioned load`)}
   if(i>=3&&rows[i].units<rows[i-1].units&&rows[i-1].units<rows[i-2].units&&rows[i-2].units<rows[i-3].units){flags.push('CONSISTENT_DECLINE');reasons.push('Consumption declined for three consecutive months')}
   const peer=monthPeers[`${meter.connection_type}|${r.month}`]||[];
   if(peer.length>=3){const mean=peer.reduce((s,x)=>s+x,0)/peer.length;const sd=Math.sqrt(peer.reduce((s,x)=>s+(x-mean)**2,0)/peer.length);if(sd>0&&Math.abs(r.units-mean)>threshold.peerStdDev*sd){flags.push('PEER_OUTLIER');reasons.push(`Consumption is more than ${threshold.peerStdDev} standard deviations from similar meters`)}}
   const score=Math.min(100,flags.reduce((s,f)=>s+weights[f],0));
   results.push({meterId:meter.id,meterCode:meter.meter_id,consumerName:meter.consumer_name,connectionType:meter.connection_type,month:r.month,units:r.units,changePercent:change,rollingAvg:avg,deviationPercent:deviation,flags,reasons,score,level:score>=61?'HIGH':score>=31?'MEDIUM':'LOW'});
  });
 }
 return results;
}
module.exports={analyzeMeters,DEFAULT_WEIGHTS};
