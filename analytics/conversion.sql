-- Landing views by category and affiliate (last 7 days)
select
  c.slug as category_slug,
  coalesce(a.handle, '(none)') as affiliate_handle,
  count(*) as views
from visits v
join categories c on c.id = v.category_id
left join affiliates a on a.id = v.affiliate_id
where v.arrived_at > now() - interval '7 days'
group by 1, 2
order by views desc;

-- Free quiz completions vs mini-report purchases (last 7 days)
with free as (
  select affiliate_id, count(*) as teasers
  from quiz_attempts
  where status in ('teaser_shown', 'mini_paid', 'full_paid')
    and created_at > now() - interval '7 days'
  group by 1
),
paid as (
  select affiliate_id, count(*) as minis
  from orders
  where product = 'mini_report'
    and created_at > now() - interval '7 days'
  group by 1
)
select
  coalesce(a.handle, '(none)') as affiliate_handle,
  f.teasers,
  coalesce(p.minis, 0) as mini_orders,
  round(100.0 * coalesce(p.minis, 0) / nullif(f.teasers, 0), 2) as free_to_mini_conversion_pct
from free f
left join paid p on p.affiliate_id = f.affiliate_id
left join affiliates a on a.id = f.affiliate_id
order by free_to_mini_conversion_pct desc nulls last;
