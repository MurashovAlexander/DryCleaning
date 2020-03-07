﻿using System;
using System.CodeDom.Compiler;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using DryCleaningAPI.Exceptions;
using Newtonsoft.Json;

namespace DryCleaningAPI.Http
{
    class Requestor
    {
        private HttpClient _client;
        private JsonSerializer _jsonSerializer;
        public Requestor(HttpClient client, JsonSerializer jsonSerializer)
        {
            _jsonSerializer = jsonSerializer;
            _client = client;
        }
        public T Get<T>(string url)
        {
            var responseMessage = _client.GetAsync(url);
            EnsureSuccessStatusCode(responseMessage.Result);
            return ReadResponse<T>(responseMessage.Result);
        }
        public T Put<T>(string url, FormUrlEncodedContent data)
        {
            var responseMessage = _client.PutAsync(url, data);
            EnsureSuccessStatusCode(responseMessage.Result);
            return ReadResponse<T>(responseMessage.Result);
        }
        public T Post<T>(string url, FormUrlEncodedContent data = null)
        {
            var responseMessage = _client.PostAsync(url, data);
            EnsureSuccessStatusCode(responseMessage.Result);
            return ReadResponse<T>(responseMessage.Result);
        }

        public void Post(string url, FormUrlEncodedContent data = null)
        {
            var responseMessage = _client.PostAsync(url, data);
            EnsureSuccessStatusCode(responseMessage.Result);
        }

        public void Put(string url, FormUrlEncodedContent data)
        {
            var responseMessage = _client.PutAsync(url, data);
            EnsureSuccessStatusCode(responseMessage.Result);
        }
        private static void EnsureSuccessStatusCode(HttpResponseMessage responseMessage)
        {
            if (responseMessage.IsSuccessStatusCode)
                return;

            string errorResponse = responseMessage.Content.ReadAsStringAsync().Result;
            throw new DryCleaningException(responseMessage.StatusCode, errorResponse ?? "");
        }
        private T ReadResponse<T>(HttpResponseMessage responseMessage)
        {
            string response = responseMessage.Content.ReadAsStringAsync().Result;
            var result = _jsonSerializer.Deserialize<T>(new JsonTextReader(new StringReader(response)));
            return result;
        }
    }
}
