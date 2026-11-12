<div class="row">
  <div class="item">
    <span class="ico" aria-hidden="true">✓</span>
    <div>
      <strong>Free shipping</strong>
      <span>On eligible orders</span>
    </div>
  </div>
  <div class="item">
    <span class="ico" aria-hidden="true">↩</span>
    <div>
      <strong>Free returns</strong>
      <span>Within 90 days</span>
    </div>
  </div>
  <div class="item">
    <span class="ico" aria-hidden="true">🔒</span>
    <div>
      <strong>Secure payments</strong>
      <span>MTN &amp; Airtel Money</span>
    </div>
  </div>
  <div class="item">
    <span class="ico" aria-hidden="true">🚚</span>
    <div>
      <strong>Delivery guarantee</strong>
      <span>Track every order</span>
    </div>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    background: #fff;
    border-radius: 6px;
    padding: 12px 10px;
    margin: 8px 0;
    border: 1px solid #ebebeb;
  }
  @media (min-width: 720px) {
    .row {
      grid-template-columns: repeat(4, 1fr);
      padding: 14px 16px;
    }
  }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
    color: #555;
    line-height: 1.25;
  }
  .ico {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #eef7fc;
    color: var(--temu-orange);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  }
  .item strong {
    display: block;
    color: #121212;
    font-size: 12px;
    font-weight: 600;
  }
</style>
