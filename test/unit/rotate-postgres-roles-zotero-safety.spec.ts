describe('PostgreSQL Zotero rotation safety probe', () => {
  function clientFor(...responses: Array<unknown>) {
    return {
      query: jest.fn(async () => {
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      }),
    };
  }

  it('treats a missing Zotero relation as an empty pristine state', async () => {
    const { checkZoteroDatabaseSafety } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const client = clientFor({ rows: [{ relation: null }] });

    await expect(checkZoteroDatabaseSafety(client)).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      "SELECT to_regclass('public.zotero_connections') AS relation",
    );
  });

  it('counts credentials only after the schema-qualified relation exists', async () => {
    const { checkZoteroDatabaseSafety } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const client = clientFor(
      { rows: [{ relation: 'public.zotero_connections' }] },
      { rows: [{ count: 0 }] },
    );

    await expect(checkZoteroDatabaseSafety(client)).resolves.toBeUndefined();
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT count(*)::int AS count FROM public.zotero_connections',
    );
  });

  it('fails closed when the relation probe fails', async () => {
    const { checkZoteroDatabaseSafety } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const client = clientFor(new Error('relation probe failed'));

    await expect(checkZoteroDatabaseSafety(client)).rejects.toThrow(
      /Zotero database safety check failed/,
    );
  });

  it('fails closed when the existing-table count query fails', async () => {
    const { checkZoteroDatabaseSafety } = require('../../deploy/scripts/rotate-postgres-roles.js');
    const client = clientFor(
      { rows: [{ relation: 'public.zotero_connections' }] },
      new Error('count query failed'),
    );

    await expect(checkZoteroDatabaseSafety(client)).rejects.toThrow(
      /Zotero database safety check failed/,
    );
  });
});
