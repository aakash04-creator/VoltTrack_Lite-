import {useEffect} from 'react';export default function usePageTitle(title){useEffect(()=>{document.title=`${title} | VoltTrack Lite`;return()=>{document.title='VoltTrack Lite'}},[title])}
