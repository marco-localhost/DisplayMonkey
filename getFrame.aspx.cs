﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Data;

namespace DisplayMonkey
{
	public partial class getFrame : System.Web.UI.Page
	{
		protected void Page_Load(object sender, EventArgs e)
		{
			if (!IsPostBack)
			{
				int frameId = DataAccess.IntOrZero(Request.QueryString["frame"]);
				int panelId = DataAccess.IntOrZero(Request.QueryString["panel"]);
				int displayId = DataAccess.IntOrZero(Request.QueryString["display"]);
				string type = DataAccess.StringOrBlank(Request.QueryString["type"]);

				//int featureId = GetQueryInt("feature");

				if (panelId == 0)
				{
					panelId = Frame.GetPanelId(frameId);
				}

				string html;

				try
				{
					if (type == "")
					{
						type = Frame.GetFrameType(frameId);
					}

					switch (type)
					{
						case "MEMO":
							html = new Memo(frameId, panelId, Server).Html;
							break;

						case "PICTURE":
							html = new Picture(frameId, panelId, Server).Html;
							break;

						case "WEATHER":
							int woeid = DataAccess.IntOrZero(Request.QueryString["woeid"]);
							string tempUnit = Request.QueryString["temperatureUnit"];
							html = new Weather(frameId, panelId, displayId, woeid, tempUnit, Server).Html;
							break;

						case "CLOCK":
							html = new Clock(frameId, panelId, displayId, Server).Html;
							break;

						case "REPORT":
							html = new Report(frameId, panelId, Server).Html;
							break;

						case "VIDEO":
						case "NEWS":
						case "HTML":
						default:
							html = string.Format("Content type {0} not implemented", type);
							break;
					}
				}

				catch (Exception ex)
				{
					html = HttpUtility.HtmlEncode(ex.Message);
				}

				// set headers
				Response.ExpiresAbsolute = DateTime.Now;
				Response.Expires = -1441;
				Response.CacheControl = "no-cache";
				Response.AddHeader("Pragma", "no-cache");
				Response.AddHeader("Pragma", "no-store");
				Response.AddHeader("cache-control", "no-cache");
				Response.Cache.SetCacheability(HttpCacheability.NoCache);
				Response.Cache.SetNoServerCaching();
				Response.Write(html);
			}
		}
	}
}