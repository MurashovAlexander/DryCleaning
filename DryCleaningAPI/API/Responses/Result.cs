﻿using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DryCleaningClient.API.Responses
{
    public class Result
    {
        public string Name { get; set; }

        public override int GetHashCode()
        {
            return Name.GetHashCode();
        }

        public override bool Equals(object obj)
        {
            bool equaled = false;
            if (obj is Result result)
            {
                equaled = result.GetHashCode().Equals(this.GetHashCode());
            }

            return equaled;
        }

        public Result Clone()
        {
            return new Result() { Name = Name };
        }

        public static readonly Result Default = new Result()
        {
            Name = ""
        };

        public override string ToString()
        {
            return Name;
        }
    }
}
