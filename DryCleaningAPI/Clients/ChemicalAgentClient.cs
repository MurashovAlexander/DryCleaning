﻿using DryCleaningClient.API.Responses;

namespace DryCleaningAPI
{
    public class ChemicalAgentClient : BaseClient
    {
        internal ChemicalAgentClient(Session session) : base(session) { }

        public ChemicalAgent[] GetChemicalAgents() => _session.Requestor.Get<ChemicalAgent[]>("/chemicalagents");

        public void Add(string name) =>
            _session.Requestor.Post($"/chemicalagents?name={name}");

        public void Add(ChemicalAgent chemicalAgent) =>
            Add(chemicalAgent.Name);

        public void Edit(string oldName, string newName) =>
            _session.Requestor.Put($"/chemicalagents/{oldName}?name={newName}");

        public void Edit(string oldName, ChemicalAgent chemicalAgent) =>
            Edit(oldName, chemicalAgent.Name);

        public void Delete(string name) =>
            _session.Requestor.Delete($"/chemicalagents/{name}");

        public void Delete(ChemicalAgent chemicalAgent) =>
            Delete(chemicalAgent.Name);
    }
}
