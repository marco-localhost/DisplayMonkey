/*!
* DisplayMonkey source file
* http://displaymonkey.org
*
* Copyright (c) 2015 Fuel9 LLC and contributors
*
* Released under the MIT license:
* http://opensource.org/licenses/MIT
*/

//------------------------------------------------------------------------------
// <auto-generated>
//    This code was generated from a template.
//
//    Manual changes to this file may cause unexpected behavior in your application.
//    Manual changes to this file will be overwritten if the code is regenerated.
// </auto-generated>
//------------------------------------------------------------------------------

namespace DisplayMonkey.Models
{
    using System;
    using System.Collections.Generic;
    
    public partial class Youtube
    {
        public int FrameId { get; set; }
        public string Name { get; set; }
        public string YoutubeId { get; set; }
        public int Volume { get; set; }
        public bool AutoLoop { get; set; }
        public YTAspect Aspect { get; set; }
        public YTQuality Quality { get; set; }
        public int Start { get; set; }
        public YTRate Rate { get; set; }
    
        public virtual Frame Frame { get; set; }
    }
}
