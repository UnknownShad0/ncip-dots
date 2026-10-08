# Office hierarchy as a possible range

## Status

Exploration note only. No application behavior has been changed to use this idea. The hierarchy in `office_lists` needs further review before implementation.

## Idea

`office_lists.parent_office_id` appears to describe an office hierarchy. The SQL dump includes regional `BSO` offices, provincial `BSO` offices whose `parent_office_id` points to a regional office, and `DIV` offices that can point to a provincial or regional office.

This hierarchy could potentially define a range-like group. Given any selected office, the application could:

1. Walk upward through `parent_office_id` until it reaches the hierarchy root.
2. Walk downward from that root to collect the root and all descendants.
3. Use that entire subtree as the office group, regardless of whether the selected office is a parent or child.

With this rule, selecting a regional office includes the region and its descendants. Selecting a division under that region first finds the region, then includes the region, its other descendants, and the selected division. A child selection therefore includes siblings through their common ancestor.

## Example query (MySQL 8+)

Replace `DIV-4824` in both locations with the `division_code` to explore. The result includes the topmost ancestor and its full descendant tree, and marks the searched office.

```sql
WITH RECURSIVE
ancestors AS (
    -- Start at the searched office.
    SELECT
        o.id,
        o.parent_office_id,
        o.division_code,
        o.division_name,
        CAST(o.id AS CHAR(2000)) AS visited_ids
    FROM office_lists AS o
    WHERE o.division_code = 'DIV-4824'
      AND o.deleted_at IS NULL

    UNION ALL

    -- Walk upward through parent_office_id.
    SELECT
        parent.id,
        parent.parent_office_id,
        parent.division_code,
        parent.division_name,
        CAST(CONCAT(ancestor.visited_ids, ',', parent.id) AS CHAR(2000))
    FROM office_lists AS parent
    JOIN ancestors AS ancestor
      ON parent.id = ancestor.parent_office_id
    WHERE parent.deleted_at IS NULL
      AND FIND_IN_SET(parent.id, ancestor.visited_ids) = 0
),
roots AS (
    -- Find the topmost ancestor reached.
    SELECT a.*
    FROM ancestors AS a
    WHERE a.parent_office_id IS NULL
       OR NOT EXISTS (
            SELECT 1
            FROM office_lists AS parent
            WHERE parent.id = a.parent_office_id
              AND parent.deleted_at IS NULL
       )
),
office_tree AS (
    -- Start walking down from that root.
    SELECT
        r.id,
        r.parent_office_id,
        r.division_code,
        r.division_name,
        0 AS depth,
        CAST(r.id AS CHAR(2000)) AS visited_ids
    FROM roots AS r

    UNION ALL

    -- Include every descendant under the root.
    SELECT
        child.id,
        child.parent_office_id,
        child.division_code,
        child.division_name,
        tree.depth + 1,
        CAST(CONCAT(tree.visited_ids, ',', child.id) AS CHAR(2000))
    FROM office_lists AS child
    JOIN office_tree AS tree
      ON child.parent_office_id = tree.id
    WHERE child.deleted_at IS NULL
      AND FIND_IN_SET(child.id, tree.visited_ids) = 0
)
SELECT
    id,
    parent_office_id,
    division_code,
    division_name,
    depth,
    (division_code = 'DIV-4824') AS is_searched_office
FROM office_tree
ORDER BY depth, parent_office_id, id;
```

`depth = 0` is the root. The cycle checks prevent a bad parent relationship from causing endless recursion. The query assumes the searched `division_code` identifies one office and that `parent_office_id` points to `office_lists.id`.

## Questions to resolve before implementation

- Does the topmost ancestor always define the intended range, or do some roots represent unrelated groupings?
- Should inactive offices be included? The sample query filters soft-deleted rows but does not filter `status`.
- Should a missing or deleted parent make an office a temporary root, as this query currently does?
- Should the hierarchy-derived group replace `offices.range_id` / `offices.legacy_range_id`, or supplement them as a fallback?
- How should offices that are not represented in `office_lists` participate?
- How deep and consistent is the parent-child data, and are there cycles or orphan rows to account for?

## Current range behavior

The application currently stores range references on `offices` as `range_id` and `legacy_range_id`. Those fields should remain conceptually distinct until the hierarchy rule is confirmed: a parent relationship describes organizational structure, while an assigned range is an explicit grouping. A future implementation should define precedence when both sources exist.
