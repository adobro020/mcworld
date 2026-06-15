var _____WB$wombat$assign$function_____ = function(name) {return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name)) || self[name]; };
if (!self.__WB_pmw) { self.__WB_pmw = function(obj) { this.__WB_source = obj; return this; } }
{
  let window = _____WB$wombat$assign$function_____("window");
  let self = _____WB$wombat$assign$function_____("self");
  let document = _____WB$wombat$assign$function_____("document");
  let location = _____WB$wombat$assign$function_____("location");
  let top = _____WB$wombat$assign$function_____("top");
  let parent = _____WB$wombat$assign$function_____("parent");
  let frames = _____WB$wombat$assign$function_____("frames");
  let opener = _____WB$wombat$assign$function_____("opener");

function openURL(myURL, useHTML){
	if(useHTML !== true){
		var myN		= 'NewWindow';
		var myWin	= window.open(myURL,myN);
		if(myWin!=null)
			myWin.focus();
		return;
	}
	
	var myN		= 'leavingSiteBumper';
	var myW		= 630;
	var myH		= 450;
	var myWin	= window.open('leaveSite.html?u='+escape(myURL),myN,'width='+myW+',height='+myH+',scrollbars=0,resizable=0,menubar=0,addressbar=0');
	if(myWin!=null)
		myWin.focus();
}
function openDownload(myFileKey, myLastSection){
	var myURL	= 'downloadFileWInstructions.html?f='+myFileKey;
	if(myLastSection!=undefined && myLastSection!=null)
		myURL += '&bs='+myLastSection;
	top.location.href = myURL;
	/*
	var myN = 'dContainer';
	var myW = 650;
	var myH = 500;
	var myWin = window.open('downloadFileWInstructions.jsp?f='+myFileKey,myN,'width='+myW+',height='+myH+',scrollbars=0,resizable=0,menubar=0,addressbar=0');
	if(myWin!=null)
		myWin.focus();
	*/
}
function changeBackgroundColor(myColor){
	document.body.style['background-color'] = myColor;
}
function getDownloadData(myFileKey){
	return fileInfo["DL_"+myFileKey];
}

//for Google Analytics(){
function trackGoogle() {
	var _uacct = MyConfig.GoogleAnalytics.account;
	var trackString = "/";
	//arguments
	for(i = 0; i < arguments.length; i++) {
		trackString += arguments[i] + "/";
	}
	if(MyConfig.GoogleAnalytics.enabled){	
		var pageTracker = _gat._getTracker(_uacct);				
		pageTracker._trackPageview(trackString);
	}	
}

//for Fan
function closeGame(){
	returnToLastPage();
}
function returnToLastSection(){
	returnToLastPage();
}
function returnToLastPage(){
	var myLastPage = getQueryStringParameter('bs') || '';
	if(myLastPage != "")
		window.location = '/en_US/#'+myLastPage;
	else if(history.length > 1)
		history.back();
	else
		window.location = '/en_US/';
}
function returnToToys(sectionid){
	window.location = '/en_US/#'+sectionid;
}

}
/*
     FILE ARCHIVED ON 19:39:46 May 22, 2013 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 20:30:58 Jul 30, 2022.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 88.015
  exclusion.robots: 0.103
  exclusion.robots.policy: 0.093
  cdx.remote: 0.074
  esindex: 0.011
  LoadShardBlock: 59.805 (3)
  PetaboxLoader3.datanode: 45.445 (4)
  CDXLines.iter: 18.167 (3)
  PetaboxLoader3.resolve: 62.606 (2)
  load_resource: 64.309
*/