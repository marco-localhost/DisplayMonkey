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
    
    public partial class Canvas
    {
        public Canvas()
        {
            this.Displays = new HashSet<Display>();
            this.Panels = new HashSet<Panel>();
        }
    
        public int CanvasId { get; set; }
        public string Name { get; set; }
        public int Height { get; set; }
        public int Width { get; set; }
        public Nullable<int> BackgroundImage { get; set; }
        public string BackgroundColor { get; set; }
        public byte[] Version { get; set; }
    
        public virtual Content Content { get; set; }
        public virtual ICollection<Display> Displays { get; set; }
        public virtual ICollection<Panel> Panels { get; set; }
    }
}
