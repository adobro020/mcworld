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

var URLParts		= document.location.href.split('/');
var URLHost			= URLParts[2];

var IS_PRD			= (URLHost.toLowerCase() == "vw.happymeal.com" || URLHost.toLowerCase() == "www.mcworld.com" || URLHost.toLowerCase() == "mcworld.com" || URLHost.toLowerCase() == "mcworld.happymeal.com")?true:false;
var IS_STG			= (URLHost.toLowerCase() == "vw.staging.happymeal.com" || URLHost.toLowerCase() == "www.staging.mcworld.com" || URLHost.toLowerCase() == "mcworld.staging.happymeal.com")?true:false;
var IS_DEV			= (URLHost.toLowerCase() == "vw.development.happymeal.com" || URLHost.toLowerCase() == "www.development.mcworld.com" || URLHost.toLowerCase() == "development.mcworld.com" || URLHost.toLowerCase() == "mcworld.development.happymeal.com")?true:false;
var IS_LOCAL = (URLHost.toLowerCase() == "localhost") || (URLHost.toLowerCase() == "127.0.0.1") ?true:false;
var IS_CREATA		= (URLHost.toLowerCase() == "dev.creatainteractive.com" || URLHost.toLowerCase() == "203.166.46.116"|| URLHost.toLowerCase() == "192.168.1.52")?true:false;

var ENV				= (IS_PRD)?'PRD':(IS_STG)?'STG':(IS_DEV)?'DEV':(IS_LOCAL)?'localhost':'CREATA';

var Locale = 'en_US';

var Base = '' + Locale + '';
if (Locale != '')
{
	Base = '/' + Locale + '/';
}

var MyConfig = {
	env:			ENV,
	serverURL:		URLParts[0]+"//"+URLHost+"/",
	baseURL:		URLParts[0]+"//"+URLHost+"/"+Locale+"/",
	swf3DIR:		"swf3/",
	mapsDIR:		"swf3/maps/",
	npcsDIR:		"swf3/npcs/",
	localeDIR:      Locale + "/",	
	serviceGatewayURL: URLParts[0]+"//"+URLHost+"/virtualworld/RemoteService",
	
	GoogleAnalytics: {
		enabled:	false,
		account:	"UA-527676-21"
	},
		
	files: {
		main: {
			url:	getQueryStringParameter("swf")	|| Base+"swf3/PlayerClient.swf",
			id:		getQueryStringParameter("id")	|| "HM3Client",
			width:	getQueryStringParameter("swfW")	|| "100%",
			height:	getQueryStringParameter("swfH")	|| "100%",
			color:	getQueryStringParameter("bgc")	|| "#000000",
			version: "10.0.45.2"
		},
		
		postcard: {
			url:	getQueryStringParameter("swf")	|| Base+"swf3/PostCard.swf",
			id:		getQueryStringParameter("id")	|| "HM3Client",
			width:	getQueryStringParameter("swfW")	|| "100%",
			height:	getQueryStringParameter("swfH")	|| "100%",
			color:	getQueryStringParameter("bgc")	|| "#000000",
			version: "10.0.45.2"
		},		

		expressInstall: {
			url:	Base+"swf3/expressinstall.swf"	
		},

		config: {
			url:	Base+"config/config.xml"
		}
	}
};


}
/*
     FILE ARCHIVED ON 20:41:49 May 22, 2013 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 20:33:55 Jul 30, 2022.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  captures_list: 251.625
  exclusion.robots: 0.182
  exclusion.robots.policy: 0.164
  cdx.remote: 0.097
  esindex: 0.014
  LoadShardBlock: 205.451 (3)
  PetaboxLoader3.datanode: 215.281 (4)
  CDXLines.iter: 17.95 (3)
  load_resource: 42.355
  PetaboxLoader3.resolve: 30.737
*/