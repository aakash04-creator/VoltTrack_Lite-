const net=require('node:net');
const concurrently=require('concurrently');

function portIsAvailable(port){
 return new Promise(resolve=>{
  const server=net.createServer();
  server.once('error',()=>resolve(false));
  server.listen(port,()=>server.close(()=>resolve(true)));
 });
}

async function start(){
 const requested=Number(process.env.PORT)||5000;
 const port=await portIsAvailable(requested)?requested:await portIsAvailable(requested+1)?requested+1:null;
 if(!port){throw new Error(`Ports ${requested} and ${requested+1} are unavailable`)}
 process.env.PORT=String(port);
 process.env.API_PORT=String(port);
 process.env.VITE_API_URL=`http://localhost:${port}/api`;
 if(port!==requested)console.warn(`Port ${requested} is busy; using ${port} for the VoltTrack API.`);
 const {result}=concurrently([
  {command:'node backend/server/index.js',name:'API',prefixColor:'blue'},
  {command:'vite --config frontend/vite.config.js --host 127.0.0.1',name:'Client',prefixColor:'green'},
 ],{prefix:'name',killOthersOn:['failure'],restartTries:0});
 await result;
}
start().catch(error=>{console.error(error.message);process.exitCode=1});