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

queryParamsObject = {};
function populateQueryParams(){
	var params = window.location.search.substring(1).split('&');
	for(var i=0; i<params.length; i++){
		var pos = params[i].indexOf('=');
		if(pos > 0){
			var key = params[i].substring(0,pos);
			var val = unescape(params[i].substring(pos+1));
			queryParamsObject[key] = val;
			if(val.indexOf('#')){
				queryParamsObject[key] = val.split('#')[0];
			}
		}
	}	
}
populateQueryParams();
function getQueryStringParameter(myName){
	return queryParamsObject[myName] || null;
}
//alert(getQueryStringParameter("w"));

function addslashes(myValue){
	return myValue.split("\\").join("\\\\");
}

function createCookie(name,value,expiresDate) {
	//alert(name+': '+value+': '+expiresDate);
	if (expiresDate) {
		//var date = new Date();
		//date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+expiresDate.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	//alert('read: '+name);
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	createCookie(name,"",-1);
}


function openPopupNewWindow(link, name, w, h)
{
	totalW = document.body.offsetWidth;
	totalH = document.body.offsetHeight;
	
	var posX = (totalW - w) / 2;
	var posY = (totalH - h) / 2;
	
	window.open(link,name,'width='+ w + ',height=' + h + ',top=' + posY + ',left=' + posX);
}

}
/*
     FILE ARCHIVED ON 19:38:37 May 22, 2013 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 20:31:44 Jul 30, 2022.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 125.372
  exclusion.robots: 0.101
  exclusion.robots.policy: 0.093
  RedisCDXSource: 3.701
  esindex: 0.009
  LoadShardBlock: 104.617 (3)
  PetaboxLoader3.datanode: 108.276 (4)
  CDXLines.iter: 14.232 (3)
  load_resource: 106.378
  PetaboxLoader3.resolve: 95.221
*/