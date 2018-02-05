/*!
* DisplayMonkey source file
* http://displaymonkey.org
*
* Copyright (c) 2018 Fuel9 LLC and contributors
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
    
    public partial class Panel
    {
        public Panel()
        {
            this.Frames = new HashSet<Frame>();
        }
    
        public int PanelId { get; set; }
        public int CanvasId { get; set; }
        public int Top { get; set; }
        public int Left { get; set; }
        public int Height { get; set; }
        public int Width { get; set; }
        public string Name { get; set; }
        public byte[] Version { get; set; }
        public double FadeLength { get; set; }
    
        public virtual Canvas Canvas { get; set; }
        public virtual ICollection<Frame> Frames { get; set; }
    }
}
